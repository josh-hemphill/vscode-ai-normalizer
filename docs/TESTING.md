# Manual test matrix

## Automated vs manual

| Area | Automated (`pnpm run test`) | Manual (this doc) |
|------|-----------------------------|-------------------|
| URL derivation, merge, secrets | TS unit tests | — |
| Model list parsing, sync merge, cache, proxy paths | TS unit tests | — |
| Proxy binary resolution | TS unit tests | VSIX install without `target/` |
| Rust XML tool extraction, config index | `cargo test` | Agent tool loop in Copilot |
| Proxy `/health`, `/admin/reload`, `/v1/models` | `test:integration` | — |
| Copilot model picker, BYOK secret prompt | — | Required before publish |
| Multi-window attach / empty-catalog guards | TS unit tests (merge, catalog) | Required before publish |
| Multi-window attach / stop ownership | — | Required before publish |
| Gemini live discovery | — | Recommended |

**CI** (`.github/workflows/ci.yml`): Rust tests, `pnpm run test:ts`, integration on Ubuntu.

```bash
pnpm run test
```

---

## Prerequisites

- VS Code **1.96+** with **Custom Endpoint** / `chatLanguageModels.json` ([docs](https://code.visualstudio.com/docs/copilot/customization/language-models))
- Proxy built: `pnpm run build` (or install VSIX which runs prepublish build)
- At least one endpoint with discovery enabled or manual `models[]`
- Upstream exposes `GET` models list (or set `discoverModels.modelsUrl`)

---

## Initial setup (onboarding)

1. Fresh profile with empty `aiNormalizer.endpoints` → status bar shows warning **add endpoint**; Output logs setup hint (no modal on activate).
2. **AI Normalizer: Add First Endpoint** → template quick pick → endpoint appended to settings → optional **Set API Key** / **Open Settings**.
3. **AI Normalizer: Getting Started** → walkthrough opens with linked commands; steps complete on setting change / commands.
4. After endpoint + key: status bar shows proxy port; **Sync Language Models** works.

---

## API key flow

1. Configure endpoint with `id` + `upstreamUrl` only (omit `apiKeySecretId`).
2. **AI Normalizer: Set Endpoint API Key** → paste test key → confirm Output logs `Stored upstream API key for endpoint "…" (secret: aiNormalizer.endpoint.…)`.
3. Verify `aiNormalizer.endpoints` may auto-gain `apiKeySecretId` matching default id.
4. **AI Normalizer: Refresh Model Catalog** — no modal on load; status bar stays normal when keys are set.
5. **AI Normalizer: Clear Endpoint API Key** — status bar uses error background and `set API key`; click it to open the key prompt.
6. Confirm synced `chatLanguageModels.json` contains `${input:chat.lm.secret.*}` only, not raw keys.

---

## Model discovery and cache

1. Configure endpoint with empty `models[]` and `discoverModels.enabled: true`.
2. Set API key (above).
3. Run **AI Normalizer: Refresh Model Catalog**.
4. Open Output → **AI Normalizer**; confirm `[discover:endpointId] N model(s) from …` uses correct URL (e.g. `…/v1beta/openai/models` for Gemini, not `…/v1/models`).
5. Locate cache file (default: extension global storage `models-cache.json`).
6. Add `aiNormalizer.modelOverrides` for one id → refresh → sync → verify `chatLanguageModels.json`.

---

## Gemini v1beta OpenAI-compatible

1. `upstreamUrl`: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
2. After refresh, derived models URL in Output must end with `/v1beta/openai/models`.
3. Adapter `openai-pass-through` for native JSON tools; use `inline-xml-tools` only for XML-only gateways.

---

## Copilot Chat / Agent

1. Start proxy (auto or **AI Normalizer: Start Proxy**).
2. **AI Normalizer: Sync Language Models**.
3. Reload window.
4. Chat → model picker → select **AI Normalizer** group model.
5. If prompted for BYOK secret (`chat.lm.secret.aiNormalizer`), use placeholder `local` unless proxy validates auth.
6. Agent mode: confirm tool loop works (`inline-xml-tools` + profile when upstream uses XML tools).

---

## Pass-through endpoint

1. Add second endpoint with `adapter: "openai-pass-through"` and discovery enabled.
2. Refresh catalog and sync.

---

## Inline chat

1. **AI Normalizer: Set Inline Chat Default Model** → pick synced model id.

---

## Ghost-text (limitations)

- Copilot ghost-text **does not** use BYOK custom endpoints.
- Experimental: `aiNormalizer.inlineCompletion.enabled: true` and upstream `/v1/completions`.

---

## Cursor

- Confirm `chatLanguageModels.json` under `%APPDATA%\Cursor\User\` (Windows) is updated.

---

## Multiple windows

**Launching two dev hosts:** The Extension Development Host window cannot start a second debug session from the project window. Use **Run and Debug → “Run Extension (2 hosts)”** (compound in `.vscode/launch.json`) or a second CLI instance with `--extensionDevelopmentPath` and a separate `--user-data-dir` (e.g. `.edh-profile-2`).

**Shared vs per-profile paths:**

| Path | Scope |
|------|--------|
| Proxy + `proxy-owner.json` | Shared (extension global storage of the profile that **owns** the proxy) |
| `models-cache.json` | Per `user-data-dir` / extension host profile |
| `chatLanguageModels.json` (Cursor/VS Code User folder) | **Shared** across all windows on the machine — not tied to `--user-data-dir` |

A second host with an empty local cache (no API keys in that profile) must **attach** without POSTing an empty config to the proxy, and must **not** auto-sync an empty catalog over an existing `chatLanguageModels.json`. After attach, sync should use `GET /v1/models` from the shared proxy when the local cache is empty.

1. Window A: **Start Proxy** (or autoStart) — Output shows `Proxy listening … (pid N)`.
2. Window B: second Extension Development Host (compound or CLI) — Output should show `Attaching to existing proxy on port …` and `Attached without reloading proxy config` (no empty reload).
3. Window B: **Sync Language Models** — models appear (from proxy if local cache empty); `chatLanguageModels.json` must not be reduced to zero models.
4. Window B: **Stop Proxy** — proxy still responds on `http://127.0.0.1:3847/health`.
5. Window A: **Stop Proxy** — proxy stops; health fails.
6. Close Window A only (while B attached) — proxy must remain up for B.

---

## VSIX smoke (pre-publish)

1. `pnpm run build` then `npx @vscode/vsce package`.
2. `npx @vscode/vsce ls` — must include `bin/**/normalizer-proxy*` and `dist/`, must **not** include `target/` or `src/`.
3. Install VSIX in a clean profile (no local `target/` folder).
4. Start Proxy → `http://127.0.0.1:3847/health` OK → Sync Language Models → reload → model picker.

---

## Stale cache / failed discovery

1. Break API key or upstream; run **Refresh Model Catalog**.
2. Confirm stale cache retained when prior fetch existed.
3. Restore key and upstream; refresh — `fetchedAt` updates.
