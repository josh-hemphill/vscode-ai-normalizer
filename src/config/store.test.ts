import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { proxyBinaryCandidates, resolveProxyBinary } from "./proxy-binary.ts";
import type { AiNormalizerSettings } from "./schema.ts";

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
  endpoints: [],
});

describe("proxyBinaryCandidates", () => {
  it("orders platform bin then flat bin then target release then debug", () => {
    const ext = path.join(os.tmpdir(), "ext-test");
    const candidates = proxyBinaryCandidates(baseSettings(), ext);
    const exe = process.platform === "win32" ? "normalizer-proxy.exe" : "normalizer-proxy";
    const platformArch = `${process.platform}-${process.arch}`;
    assert.ok(candidates[0]?.endsWith(path.join("bin", platformArch, exe)));
    assert.ok(candidates[1]?.endsWith(path.join("bin", exe)));
    assert.ok(candidates[2]?.includes(path.join("target", "release")));
    assert.ok(candidates[3]?.includes(path.join("target", "debug")));
  });

  it("uses explicit proxyBinaryPath when set", () => {
    const custom = "C:\\custom\\proxy.exe";
    const candidates = proxyBinaryCandidates(
      { ...baseSettings(), proxyBinaryPath: custom },
      "/ext"
    );
    assert.deepEqual(candidates, [custom]);
  });

  it("includes platform arch subdir when present", () => {
    const ext = path.join(os.tmpdir(), "ext-arch");
    const candidates = proxyBinaryCandidates(baseSettings(), ext);
    const platformArch = `${process.platform}-${process.arch}`;
    const hasArchPath = candidates.some((c) => c.includes(path.join("bin", platformArch)));
    assert.ok(hasArchPath);
  });
});

describe("resolveProxyBinary", () => {
  const tmpRoot = path.join(os.tmpdir(), `ai-norm-bin-${Date.now()}`);

  it("returns first existing candidate", () => {
    const binDir = path.join(tmpRoot, "bin");
    mkdirSync(binDir, { recursive: true });
    const exe = process.platform === "win32" ? "normalizer-proxy.exe" : "normalizer-proxy";
    const binFile = path.join(binDir, exe);
    writeFileSync(binFile, "");
    const resolved = resolveProxyBinary(baseSettings(), tmpRoot);
    assert.equal(resolved, binFile);
    rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("returns undefined when none exist", () => {
    const missing = path.join(os.tmpdir(), `no-proxy-${Date.now()}`);
    assert.equal(resolveProxyBinary(baseSettings(), missing), undefined);
  });
});
