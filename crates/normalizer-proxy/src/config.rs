use crate::profiles::{merge_profiles, builtin_profiles, NamedProfile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelConfig {
    pub id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default = "default_true")]
    pub tool_calling: bool,
    #[serde(default)]
    pub vision: bool,
    #[serde(default)]
    pub max_input_tokens: Option<u32>,
    #[serde(default)]
    pub max_output_tokens: Option<u32>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EndpointConfig {
    pub id: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub upstream_url: String,
    pub adapter: String,
    #[serde(default)]
    pub adapter_profile: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub models: Vec<ModelConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyConfigPayload {
    #[serde(default)]
    pub profiles: HashMap<String, NamedProfile>,
    #[serde(default)]
    pub endpoints: Vec<EndpointConfig>,
}

#[derive(Debug, Clone)]
pub struct ResolvedEndpoint {
    pub endpoint: EndpointConfig,
    pub profile: NamedProfile,
}

#[derive(Debug, Clone)]
pub struct AppState {
    pub profiles: HashMap<String, NamedProfile>,
    pub endpoints: Vec<EndpointConfig>,
    pub model_index: HashMap<String, ResolvedEndpoint>,
}

impl AppState {
    pub fn from_payload(payload: ProxyConfigPayload) -> Self {
        let profiles = merge_profiles(builtin_profiles(), payload.profiles);
        let mut model_index = HashMap::new();
        for ep in &payload.endpoints {
            let profile_name = ep
                .adapter_profile
                .clone()
                .unwrap_or_else(|| "gemini-non-customtools".into());
            let profile = profiles
                .get(&profile_name)
                .cloned()
                .unwrap_or_else(|| {
                    profiles
                        .get("gemini-non-customtools")
                        .cloned()
                        .unwrap_or_default()
                });
            let resolved = ResolvedEndpoint {
                endpoint: ep.clone(),
                profile,
            };
            for m in &ep.models {
                model_index.insert(m.id.clone(), resolved.clone());
            }
        }
        Self {
            profiles,
            endpoints: payload.endpoints,
            model_index,
        }
    }

    pub fn resolve_model(&self, model_id: &str) -> Option<&ResolvedEndpoint> {
        self.model_index.get(model_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_payload() -> ProxyConfigPayload {
        ProxyConfigPayload {
            profiles: HashMap::new(),
            endpoints: vec![
                EndpointConfig {
                    id: "ep-a".into(),
                    display_name: None,
                    upstream_url: "http://a/v1/chat/completions".into(),
                    adapter: "openai-pass-through".into(),
                    adapter_profile: None,
                    api_key: None,
                    models: vec![
                        ModelConfig {
                            id: "model-a".into(),
                            name: Some("A".into()),
                            tool_calling: true,
                            vision: false,
                            max_input_tokens: None,
                            max_output_tokens: None,
                        },
                    ],
                },
                EndpointConfig {
                    id: "ep-b".into(),
                    display_name: None,
                    upstream_url: "http://b/v1/chat/completions".into(),
                    adapter: "openai-pass-through".into(),
                    adapter_profile: None,
                    api_key: None,
                    models: vec![
                        ModelConfig {
                            id: "shared-id".into(),
                            name: None,
                            tool_calling: true,
                            vision: false,
                            max_input_tokens: None,
                            max_output_tokens: None,
                        },
                    ],
                },
            ],
        }
    }

    #[test]
    fn builds_model_index_for_all_endpoints() {
        let state = AppState::from_payload(sample_payload());
        assert!(state.resolve_model("model-a").is_some());
        assert!(state.resolve_model("shared-id").is_some());
        assert_eq!(state.model_index.len(), 2);
    }

    #[test]
    fn duplicate_model_id_last_endpoint_wins() {
        let mut payload = sample_payload();
        payload.endpoints[0].models.push(ModelConfig {
            id: "shared-id".into(),
            name: Some("from-a".into()),
            tool_calling: true,
            vision: false,
            max_input_tokens: None,
            max_output_tokens: None,
        });
        let state = AppState::from_payload(payload);
        let resolved = state.resolve_model("shared-id").expect("model");
        assert_eq!(resolved.endpoint.id, "ep-b");
    }
}
