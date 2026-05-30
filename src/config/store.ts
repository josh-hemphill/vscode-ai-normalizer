import * as fs from "node:fs/promises";
import * as vscode from "vscode";
import {
  readModelCache,
  resolveModelCachePath,
} from "../models/cache.ts";
import { resolveEndpointSecretId } from "../secrets/keys.ts";
import { endpointsWithMergedModels } from "../models/merge.ts";
import {
  BUILTIN_PROFILES,
  DEFAULT_SYNC_TARGETS,
} from "./schema.ts";
import type {
  AiNormalizerSettings,
  EndpointConfig,
  ModelCacheFile,
  NamedProfile,
  ProxyConfigPayload,
  ResolvedModel,
} from "./schema.ts";

const SECTION = "aiNormalizer";

export const getSettings = (): AiNormalizerSettings => {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  return {
    proxyPort: cfg.get<number>("proxyPort", 3847),
    autoStartProxy: cfg.get<boolean>("autoStartProxy", true),
    autoSyncOnActivate: cfg.get<boolean>("autoSyncOnActivate", true),
    proxyBinaryPath: cfg.get<string>("proxyBinaryPath", ""),
    profilesPath: cfg.get<string>("profilesPath", ""),
    modelCachePath: cfg.get<string>("modelCachePath", ""),
    copilotByokSecretId: cfg.get<string>("copilotByokSecretId", "aiNormalizer"),
    profiles: cfg.get<Record<string, NamedProfile>>("profiles", {}),
    endpoints: cfg.get<EndpointConfig[]>("endpoints", []),
    modelOverrides: cfg.get<Record<string, Partial<import("./schema.ts").ModelConfig>>>(
      "modelOverrides",
      {}
    ),
    syncTargets: cfg.get("syncTargets", DEFAULT_SYNC_TARGETS),
    inlineCompletion: cfg.get("inlineCompletion", { enabled: false }),
  };
};

export const loadMergedProfiles = async (
  settings: AiNormalizerSettings
): Promise<Record<string, NamedProfile>> => {
  const merged: Record<string, NamedProfile> = {
    ...BUILTIN_PROFILES,
    ...settings.profiles,
  };
  if (!settings.profilesPath.trim()) {
    return merged;
  }
  try {
    const raw = await fs.readFile(settings.profilesPath, "utf8");
    const fromFile = JSON.parse(raw) as Record<string, NamedProfile>;
    return { ...merged, ...fromFile };
  } catch {
    return merged;
  }
};

export const loadModelCacheForContext = async (
  context: vscode.ExtensionContext
): Promise<ModelCacheFile> => {
  const settings = getSettings();
  const cachePath = resolveModelCachePath(context, settings.modelCachePath);
  return readModelCache(cachePath);
};

export const resolveModelsForContext = async (
  context: vscode.ExtensionContext
): Promise<ResolvedModel[]> => {
  const settings = getSettings();
  const profiles = await loadMergedProfiles(settings);
  const cache = await loadModelCacheForContext(context);
  const { mergeResolvedModels } = await import("../models/merge.ts");
  return mergeResolvedModels(settings, cache, profiles);
};

export const buildProxyPayload = async (
  context: vscode.ExtensionContext,
  settings: AiNormalizerSettings,
  cache?: ModelCacheFile
): Promise<ProxyConfigPayload> => {
  const profiles = await loadMergedProfiles(settings);
  const modelCache = cache ?? (await loadModelCacheForContext(context));
  const mergedEndpoints = endpointsWithMergedModels(
    settings,
    modelCache,
    profiles
  );
  const endpoints = await Promise.all(
    mergedEndpoints.map(async (ep) => {
      const raw = await context.secrets.get(resolveEndpointSecretId(ep));
      const apiKey = raw?.trim() || undefined;
      return { ...ep, apiKey };
    })
  );
  return { profiles, endpoints };
};

export {
  proxyBinaryCandidates,
  proxyPlatformArchDir,
  resolveProxyBinary,
} from "./proxy-binary.ts";
