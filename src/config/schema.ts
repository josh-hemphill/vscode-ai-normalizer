/** Canonical configuration types for AI Normalizer. */

export interface ToolFormatProfile {
  toolCallOpen?: string;
  toolCallClose?: string;
  toolResultOpen?: string;
  toolResultClose?: string;
  argumentFormat?: string;
  allowNativeTools?: boolean;
  nameAttribute?: string;
  idAttribute?: string;
}

export interface CapabilityDefaults {
  toolCalling?: boolean;
  vision?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

export interface NamedProfile {
  toolFormatProfile?: ToolFormatProfile;
  capabilityDefaults?: CapabilityDefaults;
}

export interface ModelConfig {
  id: string;
  name?: string;
  toolCalling?: boolean;
  vision?: boolean;
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

/** Per-endpoint upstream model list discovery. */
export interface EndpointDiscoveryConfig {
  /** Default true when models[] is empty. */
  enabled?: boolean;
  /** Override; else derived from upstreamUrl. */
  modelsUrl?: string;
  refreshOnActivate?: boolean;
  ttlMinutes?: number;
}

export interface EndpointConfig {
  id: string;
  displayName?: string;
  upstreamUrl: string;
  adapter: "openai-pass-through" | "inline-xml-tools" | "json-tools-in-text";
  adapterProfile?: string;
  apiKeySecretId?: string;
  /** Optional when discoverModels.enabled; merged with discovered catalog. */
  models?: ModelConfig[];
  discoverModels?: EndpointDiscoveryConfig;
}

export interface SyncTargetConfig {
  id: string;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface InlineCompletionConfig {
  enabled?: boolean;
  endpointId?: string;
  modelId?: string;
  completionsPath?: string;
}

export interface AiNormalizerSettings {
  proxyPort: number;
  autoStartProxy: boolean;
  autoSyncOnActivate: boolean;
  proxyBinaryPath: string;
  profilesPath: string;
  /** Empty → extension globalStorage/models-cache.json */
  modelCachePath: string;
  /** chat.lm.secret.* id used in synced chatLanguageModels.json (default aiNormalizer). */
  copilotByokSecretId: string;
  profiles: Record<string, NamedProfile>;
  endpoints: EndpointConfig[];
  /** Keys: endpointId/modelId */
  modelOverrides: Record<string, Partial<ModelConfig>>;
  syncTargets: SyncTargetConfig[];
  inlineCompletion: InlineCompletionConfig;
}

export interface ProxyConfigPayload {
  profiles: Record<string, NamedProfile>;
  endpoints: Array<EndpointConfig & { apiKey?: string }>;
}

export interface ModelCatalogEntry {
  id: string;
  name: string;
  endpointId: string;
  toolCalling: boolean;
  vision: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface ModelCatalog {
  proxyBaseUrl: string;
  models: ModelCatalogEntry[];
}

/** Merged model used for proxy payload and sync. */
export interface ResolvedModel {
  id: string;
  name: string;
  endpointId: string;
  toolCalling: boolean;
  vision: boolean;
  maxInputTokens: number;
  maxOutputTokens: number;
}

export interface DiscoveredModelRow {
  id: string;
  name?: string;
}

export interface EndpointCacheEntry {
  fetchedAt: string;
  sourceUrl: string;
  models: DiscoveredModelRow[];
}

export interface ModelCacheFile {
  version: number;
  updatedAt: string;
  endpoints: Record<string, EndpointCacheEntry>;
}

export const MODEL_CACHE_VERSION = 1;

export const DEFAULT_SYNC_TARGETS: SyncTargetConfig[] = [
  {
    id: "chatLanguageModels",
    enabled: true,
    options: { providerName: "AI Normalizer" },
  },
];

export const BUILTIN_PROFILES: Record<string, NamedProfile> = {
  "gemini-non-customtools": {
    toolFormatProfile: {
      toolCallOpen: "<tool_use>",
      toolCallClose: "</tool_use>",
      toolResultOpen: "<tool_result>",
      toolResultClose: "</tool_result>",
      argumentFormat: "json-in-body",
      allowNativeTools: false,
      nameAttribute: "name",
      idAttribute: "id",
    },
    capabilityDefaults: {
      toolCalling: true,
      vision: false,
      maxInputTokens: 1_048_576,
      maxOutputTokens: 65_536,
    },
  },
};
