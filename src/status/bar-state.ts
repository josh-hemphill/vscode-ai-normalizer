export type StatusBarTone = "normal" | "warning" | "error";

export interface StatusBarView {
  text: string;
  tooltip: string;
  command: string;
  tone: StatusBarTone;
}

/** Derives status bar label, tooltip, command, and error styling. */
export const buildStatusBarView = (input: {
  proxyBaseUrl: string | undefined;
  endpointCount: number;
  missingEndpointLabels: string[];
}): StatusBarView => {
  if (input.endpointCount === 0) {
    return {
      text: "$(add) AI Normalizer: add endpoint",
      tooltip:
        "No upstream endpoints configured. Click to add your first endpoint, or run “AI Normalizer: Getting Started”.",
      command: "aiNormalizer.addFirstEndpoint",
      tone: "warning",
    };
  }

  if (input.missingEndpointLabels.length > 0) {
    const names = input.missingEndpointLabels.join(", ");
    return {
      text: "$(key) AI Normalizer: set API key",
      tooltip: `Missing upstream API key for: ${names}. Click to set.`,
      command: "aiNormalizer.setEndpointApiKey",
      tone: "error",
    };
  }

  const base = input.proxyBaseUrl;
  if (base) {
    const short = base.replace("http://127.0.0.1:", ":");
    return {
      text: `$(cloud) AI Normalizer: ${short}`,
      tooltip: "Local proxy running — click to sync language models",
      command: "aiNormalizer.syncLanguageModels",
      tone: "normal",
    };
  }

  return {
    text: "$(cloud-offline) AI Normalizer: stopped",
    tooltip: "Proxy stopped — click to start",
    command: "aiNormalizer.startProxy",
    tone: "normal",
  };
};
