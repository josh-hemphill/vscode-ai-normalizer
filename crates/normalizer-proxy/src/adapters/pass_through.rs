use super::{AdapterContext, AdapterError};
use crate::openai::ChatCompletionRequest;
use axum::body::Body;
use axum::response::Response;
use axum::http::header;

pub struct PassThroughAdapter;

impl PassThroughAdapter {
    pub async fn chat_completions(
        ctx: &AdapterContext,
        request: ChatCompletionRequest,
    ) -> Result<Response, AdapterError> {
        let body = serde_json::to_value(&request)?;
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
