import type { EndpointConfig } from "../config/schema.ts";

export type EndpointTemplateId = "gemini" | "openrouter" | "custom";

export interface EndpointTemplateChoice {
  id: EndpointTemplateId;
  label: string;
  description: string;
  build: (upstreamUrl?: string) => EndpointConfig;
}

const discoverDefaults = {
  enabled: true,
  refreshOnActivate: true,
  ttlMinutes: 60,
} as const;

export const ENDPOINT_TEMPLATE_CHOICES: EndpointTemplateChoice[] = [
  {
    id: "gemini",
    label: "Google Gemini (OpenAI-compatible)",
    description: "generativelanguage.googleapis.com v1beta/openai",
    build: () => ({
      id: "gemini",
      displayName: "Gemini",
      upstreamUrl:
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      adapter: "openai-pass-through",
      discoverModels: { ...discoverDefaults },
    }),
  },
  {
    id: "openrouter",
    label: "OpenRouter (pass-through)",
    description: "openrouter.ai OpenAI-compatible API",
    build: () => ({
      id: "openrouter",
      displayName: "OpenRouter",
      upstreamUrl: "https://openrouter.ai/api/v1/chat/completions",
      adapter: "openai-pass-through",
      discoverModels: { ...discoverDefaults },
    }),
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible URL",
    description: "Paste your upstream chat completions URL",
    build: (upstreamUrl) => ({
      id: "custom",
      displayName: "Custom endpoint",
      upstreamUrl: upstreamUrl?.trim() ?? "",
      adapter: "openai-pass-through",
      discoverModels: { ...discoverDefaults },
    }),
  },
];

/** Picks a unique endpoint id when appending to an existing list. */
export const uniqueEndpointId = (
  baseId: string,
  existing: EndpointConfig[]
): string => {
  if (!existing.some((ep) => ep.id === baseId)) {
    return baseId;
  }
  let n = 2;
  while (existing.some((ep) => ep.id === `${baseId}-${n}`)) {
    n += 1;
  }
  return `${baseId}-${n}`;
};
