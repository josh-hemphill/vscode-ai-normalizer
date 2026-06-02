use super::{AdapterContext, AdapterError};
use crate::openai::{ChatCompletionRequest, MessageContent};
use axum::body::Body;
use axum::response::Response;
use axum::http::header;

pub struct PassThroughAdapter;

impl PassThroughAdapter {
    pub async fn chat_completions(
        ctx: &AdapterContext,
        request: ChatCompletionRequest,
    ) -> Result<Response, AdapterError> {
        let sanitized = sanitize_request(request, &ctx.resolved.endpoint.tools_policy);
        let body = serde_json::to_value(&sanitized)?;
        let upstream = ctx.resolved.endpoint.upstream_url.clone();
        let mut req = ctx.client.post(&upstream).json(&body);
        if let Some(key) = &ctx.resolved.endpoint.api_key {
            if !key.is_empty() {
                req = req.bearer_auth(key);
            }
        }
        let resp = req
            .send()
            .await
            .map_err(|e| AdapterError::Upstream(e.to_string()))?;
        let status = resp.status();
        let headers = resp.headers().clone();
        let bytes = resp
            .bytes()
            .await
            .map_err(|e| AdapterError::Upstream(e.to_string()))?;
        let mut builder = Response::builder().status(status);
        if let Some(ct) = headers.get(header::CONTENT_TYPE) {
            builder = builder.header(header::CONTENT_TYPE, ct);
        }
        Ok(builder
            .body(Body::from(bytes))
            .unwrap_or_else(|_| Response::new(Body::empty())))
    }
}

fn sanitize_request(mut request: ChatCompletionRequest, tools_policy: &str) -> ChatCompletionRequest {
    if tools_policy != "strip" {
        return request;
    }
    request.tools = None;
    request.tool_choice = None;
    for msg in &mut request.messages {
        if msg.role == "tool" {
            msg.role = "user".into();
            let name = msg.name.clone().unwrap_or_else(|| "tool".into());
            let text = match &msg.content {
                Some(MessageContent::Text(s)) => s.clone(),
                Some(MessageContent::Parts(parts)) => {
                    serde_json::to_string(parts).unwrap_or_default()
                }
                None => String::new(),
            };
            msg.content = Some(MessageContent::Text(format!(
                "[Tool result for {name}] {text}"
            )));
            msg.name = None;
            msg.tool_call_id = None;
        }
        msg.tool_calls = None;
    }
    request
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::openai::{ChatMessage, ToolCall, ToolCallFunction};
    use serde_json::json;

    #[test]
    fn strip_policy_drops_tools_and_tool_choice() {
        let req = ChatCompletionRequest {
            model: "m".into(),
            messages: vec![],
            tools: Some(vec![json!({"type":"function"})]),
            tool_choice: Some(json!({"type":"auto"})),
            stream: None,
        };
        let out = sanitize_request(req, "strip");
        assert!(out.tools.is_none());
        assert!(out.tool_choice.is_none());
    }

    #[test]
    fn strip_policy_normalizes_tool_messages() {
        let req = ChatCompletionRequest {
            model: "m".into(),
            messages: vec![
                ChatMessage {
                    role: "assistant".into(),
                    content: Some(MessageContent::Text("before".into())),
                    tool_calls: Some(vec![ToolCall {
                        id: "1".into(),
                        call_type: Some("function".into()),
                        function: ToolCallFunction {
                            name: "lookup".into(),
                            arguments: "{}".into(),
                        },
                    }]),
                    tool_call_id: None,
                    name: None,
                },
                ChatMessage {
                    role: "tool".into(),
                    content: Some(MessageContent::Text("result".into())),
                    tool_calls: None,
                    tool_call_id: Some("1".into()),
                    name: Some("lookup".into()),
                },
            ],
            tools: None,
            tool_choice: None,
            stream: None,
        };
        let out = sanitize_request(req, "strip");
        assert!(out.messages[0].tool_calls.is_none());
        assert_eq!(out.messages[1].role, "user");
        let content = match &out.messages[1].content {
            Some(MessageContent::Text(s)) => s,
            _ => panic!("expected text"),
        };
        assert!(content.contains("[Tool result for lookup]"));
    }
}
