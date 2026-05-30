import * as fs from "node:fs/promises";
import * as vscode from "vscode";
import { getSettings, loadMergedProfiles } from "../config/store.ts";
import {
  getOutputChannel,
  getProxyBaseUrl,
  reloadProxyConfig,
  startProxy,
  stopProxy,
} from "../proxy/process.ts";
import { refreshModelCache } from "../models/discover.ts";
import { runSyncTargets } from "../sync/registry.ts";
import {
  clearEndpointApiKey,
  promptAndStoreEndpointApiKey,
} from "../secrets/prompt.ts";
import {
  openGettingStartedWalkthrough,
  runAddFirstEndpoint,
} from "../setup/add-first-endpoint.ts";

export const registerCommands = (
  context: vscode.ExtensionContext,
  refreshStatusBar: () => void
): void => {
  const log = getOutputChannel();

  context.subscriptions.push(
    vscode.commands.registerCommand("aiNormalizer.startProxy", async () => {
      await startProxy(context, log);
      refreshStatusBar();
    }),
    vscode.commands.registerCommand("aiNormalizer.stopProxy", async () => {
      await stopProxy(context);
      refreshStatusBar();
    }),
    vscode.commands.registerCommand("aiNormalizer.reloadProxy", async () => {
      const ok = await reloadProxyConfig(context, log);
      if (!ok) {
        await startProxy(context, log);
      }
      refreshStatusBar();
    }),
    vscode.commands.registerCommand("aiNormalizer.syncLanguageModels", async () => {
      const base = getProxyBaseUrl();
      if (!base) {
        const handle = await startProxy(context, log);
        if (!handle) {
          return;
        }
      }
      const results = await runSyncTargets(
        context,
        log,
        getProxyBaseUrl()!
      );
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        void vscode.window.showWarningMessage(
          `AI Normalizer sync: ${failed.map((f) => f.targetId).join(", ")} failed`
        );
      } else {
        void vscode.window.showInformationMessage(
          "AI Normalizer: language models synced. Reload the window if models do not appear."
        );
      }
    }),
    vscode.commands.registerCommand("aiNormalizer.exportProfile", async () => {
      const settings = getSettings();
      const profiles = await loadMergedProfiles(settings);
      const uri = await vscode.window.showSaveDialog({
        filters: { JSON: ["json"] },
        defaultUri: vscode.Uri.file("ai-normalizer-profiles.json"),
      });
      if (!uri) {
        return;
      }
      await fs.writeFile(
        uri.fsPath,
        `${JSON.stringify(profiles, null, 2)}\n`,
        "utf8"
      );
      void vscode.window.showInformationMessage(
        `Exported profiles to ${uri.fsPath}`
      );
    }),
    vscode.commands.registerCommand("aiNormalizer.addFirstEndpoint", async () => {
      const added = await runAddFirstEndpoint(context, log);
      if (added) {
        await reloadProxyConfig(context, log);
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand(
      "aiNormalizer.openGettingStarted",
      async () => {
        await openGettingStartedWalkthrough();
      }
    ),
    vscode.commands.registerCommand("aiNormalizer.setEndpointApiKey", async () => {
      const stored = await promptAndStoreEndpointApiKey(context, log);
      if (stored) {
        await reloadProxyConfig(context, log);
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand("aiNormalizer.clearEndpointApiKey", async () => {
      const cleared = await clearEndpointApiKey(context, log);
      if (cleared) {
        await reloadProxyConfig(context, log);
        refreshStatusBar();
      }
    }),
    vscode.commands.registerCommand("aiNormalizer.refreshModels", async () => {
      const { results } = await refreshModelCache(context, log, { force: true });
      const ok = await reloadProxyConfig(context, log);
      if (!ok) {
        await stopProxy(context);
        await startProxy(context, log, { skipDiscovery: true });
      }
      const base = getProxyBaseUrl();
      if (base) {
        await runSyncTargets(context, log, base);
      }
      const failed = results.filter((r) => !r.ok);
      const total = results.reduce((n, r) => n + r.modelCount, 0);
      if (failed.length > 0) {
        void vscode.window.showWarningMessage(
          `AI Normalizer: catalog refreshed (${total} models); ${failed.length} endpoint(s) had errors. See output.`
        );
      } else {
        void vscode.window.showInformationMessage(
          `AI Normalizer: discovered ${total} model(s) and synced.`
        );
      }
      refreshStatusBar();
    }),
    vscode.commands.registerCommand("aiNormalizer.setInlineChatModel", async () => {
      const { resolveModelsForContext } = await import("../config/store.ts");
      const resolved = await resolveModelsForContext(context);
      const ids = resolved.map((m) => m.id);
      if (ids.length === 0) {
        void vscode.window.showWarningMessage(
          "Configure aiNormalizer.endpoints with at least one model first."
        );
        return;
      }
      const pick = await vscode.window.showQuickPick(ids, {
        title: "Default model for inline chat (inlineChat.defaultModel)",
      });
      if (!pick) {
        return;
      }
      await vscode.workspace
        .getConfiguration("inlineChat")
        .update("defaultModel", pick, vscode.ConfigurationTarget.Global);
      void vscode.window.showInformationMessage(
        `inlineChat.defaultModel set to ${pick}`
      );
    })
  );
};
