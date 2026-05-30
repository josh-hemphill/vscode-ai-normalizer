use crate::adapters::{AdapterContext, AdapterKind, AdapterError};
use crate::config::{AppState, ResolvedEndpoint};
use crate::openai::ChatCompletionRequest;

pub async fn route_chat(
    state: &AppState,
    client: &reqwest::Client,
    request: ChatCompletionRequest,
) -> Result<axum::response::Response, AdapterError> {
    let resolved = state
        .resolve_model(&request.model)
        .cloned()
        .or_else(|| fallback_endpoint(state, &request.model))
        .ok_or_else(|| AdapterError::Other(format!("unknown model: {}", request.model)))?;
    let kind = AdapterKind::from_id(&resolved.endpoint.adapter)?;
    let ctx = AdapterContext {
        client: client.clone(),
        resolved,
    };
    kind.chat_completions(&ctx, request).await
}

fn fallback_endpoint(state: &AppState, model_id: &str) -> Option<ResolvedEndpoint> {
    let ep = state.endpoints.first()?;
    let profile_name = ep
        .adapter_profile
        .clone()
        .unwrap_or_else(|| "gemini-non-customtools".into());
    let profile = state
        .profiles
        .get(&profile_name)
        .cloned()
        .unwrap_or_default();
    let mut endpoint = ep.clone();
    if endpoint.models.iter().all(|m| m.id != model_id) {
        endpoint.models.push(crate::config::ModelConfig {
            id: model_id.to_string(),
            name: Some(model_id.to_string()),
            tool_calling: true,
            vision: false,
            max_input_tokens: None,
            max_output_tokens: None,
        });
    }
    Some(ResolvedEndpoint { endpoint, profile })
}
