import type {
  EndpointConfig,
  ModelCacheFile,
  ModelCatalog,
  ModelCatalogEntry,
  ModelConfig,
  NamedProfile,
  ResolvedModel,
} from "../config/schema.ts";
import { BUILTIN_PROFILES } from "../config/schema.ts";
import type { AiNormalizerSettings } from "../config/schema.ts";
import { isDiscoveryEnabled } from "./urls.ts";

const overrideKey = (endpointId: string, modelId: string): string =>
  `${endpointId}/${modelId}`;

const capabilityForEndpoint = (
  profiles: Record<string, NamedProfile>,
  endpoint: EndpointConfig
) => {
  const name = endpoint.adapterProfile ?? "gemini-non-customtools";
  return profiles[name]?.capabilityDefaults ?? BUILTIN_PROFILES[name]?.capabilityDefaults;
};

const applyLayer = (
  base: ResolvedModel,
  layer: Partial<ModelConfig> | undefined
): ResolvedModel => {
  if (!layer) {
    return base;
  }
  return {
    id: layer.id ?? base.id,
    name: layer.name ?? base.name,
    endpointId: base.endpointId,
    toolCalling: layer.toolCalling ?? base.toolCalling,
    vision: layer.vision ?? base.vision,
    maxInputTokens: layer.maxInputTokens ?? base.maxInputTokens,
    maxOutputTokens: layer.maxOutputTokens ?? base.maxOutputTokens,
  };
};

const manualById = (endpoint: EndpointConfig): Map<string, ModelConfig> => {
  const map = new Map<string, ModelConfig>();
  for (const m of endpoint.models ?? []) {
    map.set(m.id, m);
  }
  return map;
};

const rowsForEndpoint = (
  endpoint: EndpointConfig,
  cache: ModelCacheFile
): Array<{ id: string; name?: string }> => {
  const manual = endpoint.models ?? [];
  if (!isDiscoveryEnabled(endpoint)) {
    return manual.map((m) => ({ id: m.id, name: m.name }));
  }
  const discovered = cache.endpoints[endpoint.id]?.models ?? [];
  if (discovered.length === 0 && manual.length > 0) {
    return manual.map((m) => ({ id: m.id, name: m.name }));
  }
  const ids = new Set<string>();
  const rows: Array<{ id: string; name?: string }> = [];
  for (const d of discovered) {
    if (!ids.has(d.id)) {
      ids.add(d.id);
      rows.push(d);
    }
  }
  for (const m of manual) {
    if (!ids.has(m.id)) {
      ids.add(m.id);
      rows.push({ id: m.id, name: m.name });
    }
  }
  return rows;
};

export const mergeResolvedModels = (
  settings: AiNormalizerSettings,
  cache: ModelCacheFile,
  profiles: Record<string, NamedProfile>
): ResolvedModel[] => {
  const out: ResolvedModel[] = [];
  for (const ep of settings.endpoints) {
    const cap = capabilityForEndpoint(profiles, ep);
    const manual = manualById(ep);
    for (const row of rowsForEndpoint(ep, cache)) {
      let resolved: ResolvedModel = {
        id: row.id,
        name: row.name ?? row.id,
        endpointId: ep.id,
        toolCalling: cap?.toolCalling ?? true,
        vision: cap?.vision ?? false,
        maxInputTokens: cap?.maxInputTokens ?? 128_000,
        maxOutputTokens: cap?.maxOutputTokens ?? 8_192,
      };
      resolved = applyLayer(
        resolved,
        settings.modelOverrides[overrideKey(ep.id, row.id)]
      );
      resolved = applyLayer(resolved, manual.get(row.id));
      out.push(resolved);
    }
  }
  return out;
};

export const endpointsWithMergedModels = (
  settings: AiNormalizerSettings,
  cache: ModelCacheFile,
  profiles: Record<string, NamedProfile>
): EndpointConfig[] =>
  settings.endpoints.map((ep) => {
    const merged = mergeResolvedModels(
      { ...settings, endpoints: [ep] },
      cache,
      profiles
    );
    return {
      ...ep,
      models: merged.map((m) => ({
        id: m.id,
        name: m.name,
        toolCalling: m.toolCalling,
        vision: m.vision,
        maxInputTokens: m.maxInputTokens,
        maxOutputTokens: m.maxOutputTokens,
      })),
    };
  });

export const buildCatalogFromResolved = (
  proxyBaseUrl: string,
  resolved: ResolvedModel[]
): ModelCatalog => ({
  proxyBaseUrl,
  models: resolved.map(
    (m): ModelCatalogEntry => ({
      id: m.id,
      name: m.name,
      endpointId: m.endpointId,
      toolCalling: m.toolCalling,
      vision: m.vision,
      maxInputTokens: m.maxInputTokens,
      maxOutputTokens: m.maxOutputTokens,
    })
  ),
});
