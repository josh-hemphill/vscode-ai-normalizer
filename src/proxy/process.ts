import { ChildProcess, spawn } from "node:child_process";
import * as vscode from "vscode";
import {
  buildProxyPayload,
  getSettings,
  loadModelCacheForContext,
  proxyBinaryCandidates,
  resolveModelsForContext,
  resolveProxyBinary,
} from "../config/store.ts";
import { writeProxyConfigFile } from "./config-file.ts";
import { probeProxyHealth } from "./health.ts";
import { clearProxyOwner, readProxyOwner, writeProxyOwner } from "./owner.ts";
import { stripAnsi } from "./strip-ansi.ts";
import {
  countPayloadModels,
  fetchModelCatalogFromProxy,
} from "./catalog.ts";
import { buildCatalogFromResolved } from "../models/merge.ts";
import { refreshModelCacheIfNeeded } from "../models/discover.ts";

const OUTPUT_CHANNEL = "AI Normalizer";

export interface ProxyHandle {
  port: number;
  baseUrl: string;
}

let child: ChildProcess | undefined;
let currentPort = 0;
/** Using a proxy already listening on the port (another window or prior session). */
let attachedExternal = false;

const proxyBaseUrl = (port: number): string => `http://127.0.0.1:${port}`;

export const getOutputChannel = (): vscode.OutputChannel =>
  vscode.window.createOutputChannel(OUTPUT_CHANNEL);

export const isRunning = (): boolean =>
  (child !== undefined && child.exitCode === null) || attachedExternal;

export const getProxyBaseUrl = (): string | undefined =>
  isRunning() && currentPort > 0 ? proxyBaseUrl(currentPort) : undefined;

const clearLocalProxyState = (): void => {
  child = undefined;
  attachedExternal = false;
  currentPort = 0;
};

const waitForHealth = async (
  port: number,
  proc: ChildProcess,
  attempts = 40
): Promise<boolean> => {
  for (let i = 0; i < attempts; i += 1) {
    if (proc.exitCode !== null) {
      return false;
    }
    if (await probeProxyHealth(port)) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
};

/** POST current settings to a running proxy and persist config on disk. */
const applyProxyPayload = async (
  context: vscode.ExtensionContext,
  log: vscode.OutputChannel,
  port: number,
  options?: { allowEmpty?: boolean }
): Promise<boolean> => {
  const cache = await loadModelCacheForContext(context);
  const payload = await buildProxyPayload(context, getSettings(), cache);
  const modelCount = countPayloadModels(payload);
  if (modelCount === 0 && !options?.allowEmpty) {
    const proxyCatalog = await fetchModelCatalogFromProxy(proxyBaseUrl(port));
    if (proxyCatalog.models.length > 0) {
      log.appendLine(
        `Skipped proxy reload: local catalog empty but proxy has ${proxyCatalog.models.length} model(s)`
      );
      return true;
    }
  }
  await writeProxyConfigFile(context, payload);
  try {
    const res = await fetch(`${proxyBaseUrl(port)}/admin/reload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      log.appendLine(`Reload failed: ${res.status}`);
      return false;
    }
    log.appendLine("Proxy config reloaded");
    return true;
  } catch (err) {
    log.appendLine(`Reload error: ${String(err)}`);
    return false;
  }
};

const attachToExistingProxy = async (
  context: vscode.ExtensionContext,
  log: vscode.OutputChannel,
  port: number
): Promise<boolean> => {
  if (!(await probeProxyHealth(port))) {
    return false;
  }
  const owner = await readProxyOwner(context);
  if (owner?.pid) {
    log.appendLine(
      `Attaching to existing proxy on port ${port} (owner pid ${owner.pid})`
    );
  } else {
    log.appendLine(`Attaching to existing proxy on port ${port}`);
  }
  currentPort = port;
  attachedExternal = true;
  log.appendLine("Attached without reloading proxy config (preserves shared catalog)");
  return true;
};

export const startProxy = async (
  context: vscode.ExtensionContext,
  log: vscode.OutputChannel,
  options?: { skipDiscovery?: boolean }
): Promise<ProxyHandle | undefined> => {
  if (isRunning() && currentPort > 0) {
    return { port: currentPort, baseUrl: proxyBaseUrl(currentPort) };
  }

  const settings = getSettings();
  const port = settings.proxyPort;

  if (!options?.skipDiscovery) {
    await refreshModelCacheIfNeeded(context, log);
  }

  if (await probeProxyHealth(port)) {
    const attached = await attachToExistingProxy(context, log, port);
    if (attached) {
      return { port, baseUrl: proxyBaseUrl(port) };
    }
  }

  const cache = await loadModelCacheForContext(context);
  const binary = resolveProxyBinary(settings, context.extensionPath);
  if (!binary) {
    const tried = proxyBinaryCandidates(settings, context.extensionPath);
    log.appendLine("Proxy binary not found. Tried:");
    for (const p of tried) {
      log.appendLine(`  ${p}`);
    }
    void vscode.window.showErrorMessage(
      "AI Normalizer: proxy binary not found. Run `pnpm run build:proxy` or set aiNormalizer.proxyBinaryPath."
    );
    return undefined;
  }
  const payload = await buildProxyPayload(context, settings, cache);
  const { path: configPath, bytes: configBytes } = await writeProxyConfigFile(
    context,
    payload
  );
  const modelCount = payload.endpoints.reduce(
    (n, ep) => n + (ep.models?.length ?? 0),
    0
  );
  log.appendLine(
    `Starting proxy: ${binary} (${modelCount} models, config ${configBytes} bytes)`
  );
  currentPort = port;
  attachedExternal = false;

  let spawnError: string | undefined;
  child = spawn(binary, [], {
    env: {
      ...process.env,
      NO_COLOR: "1",
      AI_NORMALIZER_PORT: String(port),
      AI_NORMALIZER_CONFIG_PATH: configPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.on("error", (err) => {
    spawnError = err.message;
    log.appendLine(`Proxy spawn error: ${err.message}`);
  });
  const appendProxyLog = (chunk: Buffer): void => {
    log.append(stripAnsi(chunk.toString()));
  };
  child.stdout?.on("data", appendProxyLog);
  child.stderr?.on("data", appendProxyLog);
  child.on("exit", (code) => {
    log.appendLine(`Proxy exited with code ${code ?? "unknown"}`);
    void clearProxyOwner(context);
    clearLocalProxyState();
  });

  const healthy = await waitForHealth(port, child);
  if (!healthy) {
    const exitCode = child.exitCode;
    log.appendLine(
      `Proxy failed health check${exitCode !== null ? ` (exit ${exitCode})` : ""}${spawnError ? `: ${spawnError}` : ""}`
    );
    child = undefined;
    attachedExternal = false;
    if (await probeProxyHealth(port)) {
      log.appendLine("Another proxy is already listening; attaching instead.");
      if (await attachToExistingProxy(context, log, port)) {
        return { port, baseUrl: proxyBaseUrl(port) };
      }
    }
    await stopProxy(context);
    const hint =
      exitCode !== null || spawnError
        ? "See AI Normalizer output for errors (port in use, missing binary, or bad config)."
        : "Build with `pnpm run build:proxy` or check the port is free.";
    void vscode.window.showErrorMessage(`AI Normalizer: proxy failed to start. ${hint}`);
    return undefined;
  }

  if (child.pid !== undefined) {
    await writeProxyOwner(context, child.pid, port);
    log.appendLine(
      `Proxy listening on http://127.0.0.1:${port} (pid ${child.pid})`
    );
  } else {
    log.appendLine(`Proxy listening on http://127.0.0.1:${port}`);
  }
  return { port, baseUrl: proxyBaseUrl(port) };
};

/** Stops only a proxy process this window spawned; detaches from shared proxies. */
export const stopProxy = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  if (child !== undefined && child.exitCode === null) {
    child.kill();
    await clearProxyOwner(context);
  }
  clearLocalProxyState();
};

export const reloadProxyConfig = async (
  context: vscode.ExtensionContext,
  log: vscode.OutputChannel
): Promise<boolean> => {
  const port = getSettings().proxyPort;
  if (!isRunning() || currentPort <= 0) {
    if (!(await attachToExistingProxy(context, log, port))) {
      return false;
    }
  }
  if (!(await probeProxyHealth(currentPort))) {
    clearLocalProxyState();
    return false;
  }
  return applyProxyPayload(context, log, currentPort);
};

export const buildModelCatalog = async (
  context: vscode.ExtensionContext,
  baseUrl: string
): Promise<import("../config/schema.ts").ModelCatalog> => {
  const resolved = await resolveModelsForContext(context);
  const local = buildCatalogFromResolved(baseUrl, resolved);
  if (local.models.length > 0) {
    return local;
  }
  const fromProxy = await fetchModelCatalogFromProxy(baseUrl);
  if (fromProxy.models.length > 0) {
    return fromProxy;
  }
  return local;
};
