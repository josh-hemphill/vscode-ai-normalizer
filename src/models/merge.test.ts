import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyCache } from "./cache-store.ts";
import { endpointsWithMergedModels, mergeResolvedModels } from "./merge.ts";
import type { AiNormalizerSettings } from "../config/schema.ts";
import { BUILTIN_PROFILES } from "../config/schema.ts";

const baseSettings = (): AiNormalizerSettings => ({
  proxyPort: 3847,
  autoStartProxy: true,
  autoSyncOnActivate: true,
  proxyBinaryPath: "",
  profilesPath: "",
  modelCachePath: "",
  copilotByokSecretId: "aiNormalizer",
  profiles: {},
  modelOverrides: {},
  syncTargets: [],
  inlineCompletion: { enabled: false },
  endpoints: [
    {
      id: "ep1",
      upstreamUrl: "https://api.example.com/v1/chat/completions",
      adapter: "openai-pass-through",
      adapterProfile: "gemini-non-customtools",
    },
  ],
});

describe("mergeResolvedModels", () => {
  it("uses discovered models from cache", () => {
    const cache = emptyCache();
    cache.endpoints.ep1 = {
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://api.example.com/v1/models",
      models: [{ id: "gpt-4", name: "GPT-4" }],
    };
    const merged = mergeResolvedModels(
      baseSettings(),
      cache,
      BUILTIN_PROFILES
    );
    assert.equal(merged.length, 1);
    assert.equal(merged[0].id, "gpt-4");
    assert.equal(merged[0].name, "GPT-4");
    assert.equal(merged[0].toolCalling, true);
  });

  it("applies modelOverrides over capability defaults", () => {
    const cache = emptyCache();
    cache.endpoints.ep1 = {
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://api.example.com/v1/models",
      models: [{ id: "gpt-4" }],
    };
    const settings = baseSettings();
    settings.modelOverrides["ep1/gpt-4"] = {
      toolCalling: false,
      maxOutputTokens: 4096,
    };
    const merged = mergeResolvedModels(settings, cache, BUILTIN_PROFILES);
    assert.equal(merged[0].toolCalling, false);
    assert.equal(merged[0].maxOutputTokens, 4096);
  });

  it("manual models entry wins over overrides for same field", () => {
    const cache = emptyCache();
    cache.endpoints.ep1 = {
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://api.example.com/v1/models",
      models: [{ id: "gpt-4" }],
    };
    const settings = baseSettings();
    settings.modelOverrides["ep1/gpt-4"] = { toolCalling: false };
    settings.endpoints[0].models = [{ id: "gpt-4", toolCalling: true }];
    const merged = mergeResolvedModels(settings, cache, BUILTIN_PROFILES);
    assert.equal(merged[0].toolCalling, true);
  });

  it("passes unknown override fields to extras", () => {
    const cache = emptyCache();
    cache.endpoints.ep1 = {
      fetchedAt: new Date().toISOString(),
      sourceUrl: "https://api.example.com/v1/models",
      models: [{ id: "gpt-4" }],
    };
    const settings = baseSettings();
    settings.modelOverrides["ep1/gpt-4"] = {
      thinking: true,
      family: "gpt",
    };
    const merged = mergeResolvedModels(settings, cache, BUILTIN_PROFILES);
    assert.equal(merged[0].thinking, true);
    assert.equal(merged[0].extras.family, "gpt");
  });

  it("preserves endpoint toolsPolicy in merged endpoints", () => {
    const cache = emptyCache();
    const settings = baseSettings();
    settings.endpoints[0].toolsPolicy = "strip";
    settings.endpoints[0].models = [{ id: "gpt-4" }];
    const endpoints = endpointsWithMergedModels(settings, cache, BUILTIN_PROFILES);
    assert.equal(endpoints[0].toolsPolicy, "strip");
  });
});
