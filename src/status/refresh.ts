import * as vscode from "vscode";
import { getSettings } from "../config/store.ts";
import { isDiscoveryEnabled } from "../models/urls.ts";
import { getProxyBaseUrl } from "../proxy/process.ts";
import { endpointsMissingApiKey } from "../secrets/prompt.ts";
import { buildStatusBarView } from "./bar-state.ts";

/** Updates the status bar from proxy state and stored API keys. */
export const refreshNormalizerStatusBar = async (
  context: vscode.ExtensionContext,
  statusBarItem: vscode.StatusBarItem
): Promise<void> => {
  const settings = getSettings();
  const missing = await endpointsMissingApiKey(
    context,
    settings.endpoints,
    isDiscoveryEnabled
  );
  const view = buildStatusBarView({
    proxyBaseUrl: getProxyBaseUrl(),
    endpointCount: settings.endpoints.length,
    missingEndpointLabels: missing.map((ep) => ep.displayName ?? ep.id),
  });

  statusBarItem.text = view.text;
  statusBarItem.tooltip = view.tooltip;
  statusBarItem.command = view.command;

  if (view.tone === "error") {
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.errorBackground"
    );
    statusBarItem.color = new vscode.ThemeColor(
      "statusBarItem.errorForeground"
    );
  } else if (view.tone === "warning") {
    statusBarItem.backgroundColor = new vscode.ThemeColor(
      "statusBarItem.warningBackground"
    );
    statusBarItem.color = new vscode.ThemeColor(
      "statusBarItem.warningForeground"
    );
  } else {
    statusBarItem.backgroundColor = undefined;
    statusBarItem.color = undefined;
  }
};
