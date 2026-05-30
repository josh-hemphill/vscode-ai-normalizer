mod inline_xml_tools;
mod pass_through;

pub use inline_xml_tools::InlineXmlToolsAdapter;
pub use pass_through::PassThroughAdapter;

use crate::config::ResolvedEndpoint;
use crate::openai::ChatCompletionRequest;
use axum::response::Response;
use reqwest::Client;

#[derive(Clone)]
pub struct AdapterContext {
    pub client: Client,
    pub resolved: ResolvedEndpoint,
}

#[derive(Debug, thiserror::Error)]
pub enum AdapterError {
    #[error("upstream HTTP error: {0}")]
    Upstream(String),
    #[error("serialization: {0}")]
    Serde(#[from] serde_json::Error),
    #[error("{0}")]
    Other(String),
}

#[derive(Clone, Copy)]
pub enum AdapterKind {
    PassThrough,
    InlineXmlTools,
}

impl AdapterKind {
    pub fn from_id(id: &str) -> Result<Self, AdapterError> {
        match id {
            "openai-pass-through" => Ok(Self::PassThrough),
            "inline-xml-tools" | "json-tools-in-text" => Ok(Self::InlineXmlTools),
            other => Err(AdapterError::Other(format!("unknown adapter: {other}"))),
        }
    }

    pub async fn chat_completions(
        self,
        ctx: &AdapterContext,
        request: ChatCompletionRequest,
    ) -> Result<Response, AdapterError> {
        match self {
            Self::PassThrough => PassThroughAdapter::chat_completions(ctx, request).await,
            Self::InlineXmlTools => InlineXmlToolsAdapter::chat_completions(ctx, request).await,
        }
    }
}
