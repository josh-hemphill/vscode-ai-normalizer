import * as vscode from "vscode";
import { getSettings } from "./config/store.ts";
import { registerCommands } from "./commands/index.ts";
import { registerInlineCompletion } from "./inline/completion.ts";
import { refreshModelCacheIfNeeded } from "./models/discover.ts";
import {
  buildModelCatalog,
  getOutputChannel,
  getProxyBaseUrl,
  reloadProxyConfig,
  startProxy,
  stopProxy,
} from "./proxy/process.ts";
import { runSyncTargets } from "./sync/registry.ts";
import { refreshNormalizerStatusBar } from "./status/refresh.ts";

let statusBarItem: vscode.StatusBarItem | undefined;
let extensionContext: vscode.ExtensionContext | undefined;

const refreshStatusBar = (): void => {
  if (!statusBarItem || !extensionContext) {
    return;
  }
  void refreshNormalizerStatusBar(extensionContext, statusBarItem);
};

export const activate = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  extensionContext = context;
  const log = getOutputChannel();
  context.subscriptions.push(log);

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  context.subscriptions.push(statusBarItem);
  statusBarItem.show();

  registerCommands(context, refreshStatusBar);
  registerInlineCompletion(context);

  const settings = getSettings();
  if (settings.endpoints.length === 0) {
    log.appendLine(
      "Setup: no endpoints configured. Click the status bar “add endpoint” or run “AI Normalizer: Add First Endpoint” / “Getting Started”."
    );
  }
  if (settings.autoStartProxy) {
    await refreshModelCacheIfNeeded(context, log, { secretRetries: 5 });
    await startProxy(context, log, { skipDiscovery: true });
    const base = getProxyBaseUrl();
    if (base) {
      await reloadProxyConfig(context, log);
      refreshStatusBar();
      if (settings.autoSyncOnActivate) {
        const catalog = await buildModelCatalog(context, base);
        if (catalog.models.length > 0) {
          await runSyncTargets(context, log, base);
        } else {
          log.appendLine(
            "Skipped auto-sync: no models in local cache or proxy (will not overwrite chatLanguageModels.json)"
          );
        }
      }
    } else {
      refreshStatusBar();
    }
  } else {
    refreshStatusBar();
  }

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (!e.affectsConfiguration("aiNormalizer")) {
        return;
      }
      if (getProxyBaseUrl()) {
        await reloadProxyConfig(context, log);
        const base = getProxyBaseUrl();
        if (base) {
          const catalog = await buildModelCatalog(context, base);
          if (catalog.models.length > 0) {
            await runSyncTargets(context, log, base);
          }
        }
      }
      refreshStatusBar();
    })
  );
};

export const deactivate = async (): Promise<void> => {
  if (extensionContext) {
    await stopProxy(extensionContext);
  }
};
