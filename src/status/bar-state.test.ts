import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildStatusBarView } from "./bar-state.ts";

describe("buildStatusBarView", () => {
  it("shows add endpoint when none configured", () => {
    const view = buildStatusBarView({
      proxyBaseUrl: "http://127.0.0.1:3847",
      endpointCount: 0,
      missingEndpointLabels: [],
    });
    assert.equal(view.tone, "warning");
    assert.equal(view.command, "aiNormalizer.addFirstEndpoint");
    assert.match(view.text, /add endpoint/);
  });

  it("prioritizes missing API key over running proxy", () => {
    const view = buildStatusBarView({
      proxyBaseUrl: "http://127.0.0.1:3847",
      endpointCount: 1,
      missingEndpointLabels: ["Gemini"],
    });
    assert.equal(view.tone, "error");
    assert.equal(view.command, "aiNormalizer.setEndpointApiKey");
    assert.match(view.text, /set API key/);
  });

  it("shows running proxy when keys present", () => {
    const view = buildStatusBarView({
      proxyBaseUrl: "http://127.0.0.1:3847",
      endpointCount: 1,
      missingEndpointLabels: [],
    });
    assert.equal(view.tone, "normal");
    assert.equal(view.command, "aiNormalizer.syncLanguageModels");
    assert.match(view.text, /3847/);
  });

  it("shows stopped when no proxy and no missing keys", () => {
    const view = buildStatusBarView({
      proxyBaseUrl: undefined,
      endpointCount: 1,
      missingEndpointLabels: [],
    });
    assert.equal(view.command, "aiNormalizer.startProxy");
    assert.match(view.text, /stopped/);
  });
});
