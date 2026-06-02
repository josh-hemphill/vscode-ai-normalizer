# VS Code AI Normalizer

**One local proxy. Many VS Code AI surfaces.** Route Copilot Chat, Agent mode, and inline chat through your own OpenAI-compatible endpoints—even when the upstream model speaks inline XML tools instead of JSON `tool_calls`.

AI Normalizer runs a lightweight **local proxy**, translates tool formats via pluggable adapters, **discovers models** from each upstream `GET /v1/models`, and syncs them into VS Code BYOK [`chatLanguageModels.json`](https://code.visualstudio.com/docs/copilot/customization/language-models).

---

## Who this is for

- You use a **custom or proxied API** (Gemini non-`customtools`, OpenRouter, vLLM, corporate gateway) with VS Code Copilot BYOK.
- Upstream returns **XML / text tool calls** but VS Code expects **OpenAI-style JSON** tools.
- You want **one config** for endpoints, per-model overrides, and automatic model list refresh—without hand-editing every model id.

---

## Requirements

| Requirement | Notes |
|-------------|--------|
| VS Code **1.96+** | Language model BYOK APIs |
| **Custom Endpoint** provider | [Language models in VS Code](https://code.visualstudio.com/docs/copilot/customization/language-models) |
| `normalizer-proxy` binary | Built via `pnpm run build:proxy` (dev) or bundled with the extension |
| Copilot BYOK policy | Business/Enterprise may need admin opt-in |

---

## How it works

```text
Copilot Chat / Agent
        │
        ▼
http://127.0.0.1:3847/v1/chat/completions  (AI Normalizer proxy)
        │
        ├── adapter: inline-xml-tools  → XML ↔ JSON tool_calls
        └── adapter: openai-pass-through → unchanged
        │
        ▼
Your upstream API (Gemini proxy, OpenRouter, etc.)
```

On activate, the extension:

1. **Discovers** models per endpoint (`GET /v1/models` or custom `modelsUrl`).
2. **Caches** results in `models-cache.json` (global storage).
3. **Merges** with `aiNormalizer.modelOverrides` and optional manual `models[]`.
4. **Reloads** the proxy and **syncs** `chatLanguageModels.json`.

---

## Installation

**From source (development):**

```bash
pnpm install
pnpm run build
```

Press **F5** to launch an Extension Development Host (`.vscode` preLaunch runs `pnpm run build`, which compiles TypeScript and builds `bin/normalizer-proxy`). Or package a VSIX with `pnpm run build` then `npx @vscode/vsce package` — see [docs/PUBLISHING.md](docs/PUBLISHING.md).

**End users:** Install [**AI Endpoint Normalizer**](https://marketplace.visualstudio.com/items?itemName=jo-hemphill.ai-endpoint-normalizer) from the Marketplace (enable **Pre-release** until stable) or install the VSIX from [GitHub Releases](https://github.com/josh-hemphill/vscode-ai-normalizer/releases). Configure endpoints below, run **AI Normalizer: Sync Language Models**, reload the window if models do not appear. The extension ships `bin/normalizer-proxy` (platform-specific); override with `aiNormalizer.proxyBinaryPath` if needed.

**Questions & bugs:** [GitHub Issues](https://github.com/josh-hemphill/vscode-ai-normalizer/issues)

---

## Configuration reference

| Setting | Default | Description |
|---------|---------|-------------|
| `aiNormalizer.proxyPort` | `3847` | Local proxy port |
| `aiNormalizer.autoStartProxy` | `true` | Start proxy on activation |
| `aiNormalizer.autoSyncOnActivate` | `true` | Sync language models after proxy is up |
| `aiNormalizer.proxyBinaryPath` | `""` | Override path to `normalizer-proxy` |
| `aiNormalizer.profilesPath` | `""` | External JSON for named tool profiles |
| `aiNormalizer.profiles` | `{}` | Inline named profiles |
| `aiNormalizer.modelCachePath` | `""` | Discovered-models cache file (empty = global storage) |
| `aiNormalizer.copilotByokSecretId` | `aiNormalizer` | `chat.lm.secret.*` id in synced `chatLanguageModels.json` |
| `aiNormalizer.modelOverrides` | `{}` | Per-model overrides, keys `endpointId/modelId`; unknown keys pass through to synced `chatLanguageModels.json` model entries |
| `aiNormalizer.endpoints` | `[]` | Upstream endpoints (see below) |
| `aiNormalizer.syncTargets` | `[chatLanguageModels]` | Which consumers to update |
| `aiNormalizer.inlineCompletion` | `{ enabled: false }` | Experimental FIM inline provider |

**Per endpoint:**

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable id for routing and overrides |
| `upstreamUrl` | yes | Chat completions URL upstream |
| `adapter` | yes | `inline-xml-tools`, `openai-pass-through`, or `json-tools-in-text` |
| `toolsPolicy` | no | `forward` (default) or `strip` to remove tool payload fields before forwarding |
| `adapterProfile` | no | Named profile (e.g. `gemini-non-customtools`) |
| `apiKeySecretId` | no | SecretStorage key (default `aiNormalizer.endpoint.<id>`) |
| `discoverModels` | no | Discovery options (see auto-discovery example) |
| `models` | no | Manual pin list; merged with discovered ids |

**`discoverModels`:**

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` if `models[]` empty | Fetch upstream model list |
| `modelsUrl` | derived from `upstreamUrl` | Override list URL |
| `refreshOnActivate` | `true` | Refetch when stale on startup |
| `ttlMinutes` | `60` | Cache TTL before refetch |

**Models URL derivation** (override with `discoverModels.modelsUrl` if needed):

| Upstream `upstreamUrl` (chat) | Derived `modelsUrl` |
|------------------------------|---------------------|
| `…/v1/chat/completions` | `…/v1/models` |
| `…/v1beta/openai/chat/completions` | `…/v1beta/openai/models` |
| `…/v1beta/openai` | `…/v1beta/openai/models` |
| `…/openai/chat/completions` | `…/openai/models` |
| `…/openai` | `…/openai/models` |

---

## Quick start (Gemini OpenAI-compatible)

1. Add endpoint settings (no API key in JSON):

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "gemini",
      "displayName": "Gemini",
      "upstreamUrl": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "adapter": "openai-pass-through",
      "discoverModels": { "enabled": true }
    }
  ]
}
```

2. Command Palette → **AI Normalizer: Set Endpoint API Key** → paste your [Gemini API key](https://aistudio.google.com/apikey).
3. **AI Normalizer: Refresh Model Catalog** → **AI Normalizer: Sync Language Models** → reload VS Code window.
4. Pick **AI Normalizer** model in Chat; if prompted for a BYOK secret, enter `local` (see [API keys](#api-keys) below).

---

## Configuration examples

### Gemini Google OpenAI-compatible (`/v1beta/openai/`)

Official compat base uses `/v1beta/openai/` (not `/v1/`). Use full chat completions URL; models URL is derived automatically.

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "gemini",
      "upstreamUrl": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      "adapter": "openai-pass-through",
      "discoverModels": { "enabled": true }
    }
  ]
}
```

Run **Set Endpoint API Key** (stores under `aiNormalizer.endpoint.gemini` by default). For XML-tool proxies, use `inline-xml-tools` + `gemini-non-customtools` profile instead.

### Gemini (non-customtools, XML tools)

Upstream returns `<tool_use>` blocks; Copilot needs JSON `tool_calls`.

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "gemini-locked",
      "displayName": "Gemini (normalized)",
      "upstreamUrl": "https://your-proxy.example/v1/chat/completions",
      "adapter": "inline-xml-tools",
      "adapterProfile": "gemini-non-customtools",
      "discoverModels": {
        "enabled": true,
        "ttlMinutes": 120
      }
    }
  ]
}
```

Run **AI Normalizer: Set Endpoint API Key** after saving settings.

### Tool prompts (`inline-xml-tools` profiles)

For endpoints using **`inline-xml-tools`** and a named **`adapterProfile`**, the proxy can inject extra guidance for upstreams that mishandle tools:

| Layer | Behavior |
|-------|----------|
| **Tools preamble** | When the client sends `tools`, a built-in system message describes XML tool format + schema (see `gemini-non-customtools` in `aiNormalizer.profiles`). |
| **`additionalSystemPrompts`** | Optional strings on the same profile; each becomes a separate `system` message **after** the tools preamble, **before** Copilot/user messages. |
| **`openai-pass-through`** | No injection; request is forwarded unchanged. |

Example tuning:

```json
{
  "aiNormalizer.profiles": {
    "gemini-non-customtools": {
      "additionalSystemPrompts": [
        "When the user requests an action, call a tool instead of only describing steps."
      ]
    }
  }
}
```

This does **not** remove or replace system messages already sent by Copilot.

### OpenAI-compatible pass-through (OpenRouter, vLLM)

No tool translation; discovery still works.

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "openrouter",
      "upstreamUrl": "https://openrouter.ai/api/v1/chat/completions",
      "adapter": "openai-pass-through",
      "discoverModels": { "enabled": true }
    }
  ]
}
```

### Auto-discovery only (no manual model list)

Leave `models` omitted or `[]`. Overrides tune discovered ids:

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "local-llm",
      "upstreamUrl": "http://127.0.0.1:1234/v1/chat/completions",
      "adapter": "openai-pass-through",
      "discoverModels": {
        "enabled": true,
        "modelsUrl": "http://127.0.0.1:1234/v1/models"
      }
    }
  ],
  "aiNormalizer.modelOverrides": {
    "local-llm/llama3": {
      "name": "Llama 3 Local",
      "toolCalling": true,
      "maxInputTokens": 32768,
      "maxOutputTokens": 4096
    }
  }
}
```

### Per-model overrides (Agent vs chat)

Disable tools for a model that does not support Agent mode:

```json
{
  "aiNormalizer.modelOverrides": {
    "openrouter/meta-llama/llama-3-70b-instruct": {
      "toolCalling": false,
      "name": "Llama 3 70B (chat only)"
    }
  }
}
```

Keys are always `endpointId/modelId` where `modelId` matches the upstream list id.

Extra override keys are preserved in synced `chatLanguageModels.json` model objects. Useful fields include `thinking`, `streaming`, and provider-specific metadata.

### Endpoints without tool calling

If upstream security policy strips/blocks tool calls, use a chat-only route:

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "corp-chat",
      "upstreamUrl": "https://gateway.example/v1/chat/completions",
      "adapter": "openai-pass-through",
      "toolsPolicy": "strip",
      "adapterProfile": "chat-only"
    }
  ],
  "aiNormalizer.modelOverrides": {
    "corp-chat/model-id": {
      "toolCalling": false,
      "thinking": true
    }
  }
}
```

`toolsPolicy: "strip"` removes outbound `tools`/`tool_choice`, normalizes tool-role history to plain text, and strips assistant `tool_calls`. This keeps chat usable when agent/tool protocols are filtered.

### Manual pin + discovery

Keep a manual entry to force capabilities for one id; discovery fills the rest:

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "gemini-locked",
      "upstreamUrl": "https://your-proxy.example/v1/chat/completions",
      "adapter": "inline-xml-tools",
      "adapterProfile": "gemini-non-customtools",
      "discoverModels": { "enabled": true },
      "models": [
        {
          "id": "gemini-2.5-pro",
          "toolCalling": true,
          "maxInputTokens": 1048576,
          "maxOutputTokens": 65536
        }
      ]
    }
  ]
}
```

Merge order: discovered → profile defaults → `modelOverrides` → manual `models[]` (manual wins on conflicts).

### Multi-endpoint

All models appear under one BYOK provider group (default name **AI Normalizer**):

```json
{
  "aiNormalizer.endpoints": [
    {
      "id": "gemini-locked",
      "upstreamUrl": "https://gemini-proxy.example/v1/chat/completions",
      "adapter": "inline-xml-tools",
      "adapterProfile": "gemini-non-customtools",
      "discoverModels": { "enabled": true }
    },
    {
      "id": "openrouter",
      "upstreamUrl": "https://openrouter.ai/api/v1/chat/completions",
      "adapter": "openai-pass-through",
      "discoverModels": { "enabled": true }
    }
  ]
}
```

### Custom XML tool profile

```json
{
  "aiNormalizer.profiles": {
    "my-gateway-xml": {
      "toolFormatProfile": {
        "toolCallOpen": "<invoke>",
        "toolCallClose": "</invoke>",
        "toolResultOpen": "<result>",
        "toolResultClose": "</result>",
        "nameAttribute": "tool",
        "idAttribute": "call_id"
      },
      "capabilityDefaults": {
        "toolCalling": true,
        "maxInputTokens": 200000,
        "maxOutputTokens": 8192
      }
    }
  },
  "aiNormalizer.endpoints": [
    {
      "id": "gateway",
      "upstreamUrl": "https://gateway.example/v1/chat/completions",
      "adapter": "inline-xml-tools",
      "adapterProfile": "my-gateway-xml",
      "discoverModels": { "enabled": true }
    }
  ]
}
```

### External profiles file

```json
{
  "aiNormalizer.profilesPath": "C:\\Users\\you\\.config\\ai-normalizer\\profiles.json"
}
```

### Sync provider name

```json
{
  "aiNormalizer.syncTargets": [
    {
      "id": "chatLanguageModels",
      "enabled": true,
      "options": { "providerName": "My Company AI" }
    }
  ]
}
```

### Inline editor chat

After sync, run **AI Normalizer: Set Inline Chat Default Model** or set:

```json
{
  "inlineChat.defaultModel": "gemini-2.5-pro"
}
```

(use the exact model `id` from the picker).

### Experimental ghost-text completions

Copilot ghost-text does **not** use BYOK. Optional FIM via the extension:

```json
{
  "aiNormalizer.inlineCompletion": {
    "enabled": true,
    "modelId": "codestral-latest",
    "completionsPath": "/v1/completions"
  }
}
```

---

## API keys

There are **two separate keys**. Most setup friction is from mixing them up.

### 1. Upstream API key (required for discovery and proxy → provider)

Used as `Authorization: Bearer …` when the extension discovers models and when the proxy calls Gemini/OpenRouter/etc.

| Step | Action |
|------|--------|
| 1 | Configure `aiNormalizer.endpoints[].id` + `upstreamUrl` (optional `apiKeySecretId`; default is `aiNormalizer.endpoint.<id>`) |
| 2 | **AI Normalizer: Set Endpoint API Key** — pick endpoint, paste key (stored in VS Code SecretStorage) |
| 3 | **AI Normalizer: Refresh Model Catalog** |

To remove a key: **AI Normalizer: Clear Endpoint API Key**.

Keys are **never** written to `settings.json` or `chatLanguageModels.json`.

### 2. Copilot BYOK key (VS Code → local proxy)

Synced models use `"apiKey": "${input:chat.lm.secret.<id>}"` where `<id>` is `aiNormalizer.copilotByokSecretId` (default `aiNormalizer`).

When you first use a synced model, VS Code may prompt for this secret. The local proxy usually **does not** validate it — enter any placeholder such as `local` or `none`. Only use a real value if you add auth on the proxy later.

**Never commit API keys** in git-tracked files.

---

## Commands

| Command | Description |
|---------|-------------|
| AI Normalizer: Start Proxy | Start local proxy |
| AI Normalizer: Stop Proxy | Stop proxy if **this window** started it; otherwise detach from a shared proxy |
| AI Normalizer: Reload Proxy Config | Push config to `/admin/reload` |
| AI Normalizer: **Set Endpoint API Key** | Store upstream Bearer token (SecretStorage) |
| AI Normalizer: Clear Endpoint API Key | Remove stored upstream key |
| AI Normalizer: **Refresh Model Catalog** | Force upstream discovery, reload proxy, sync |
| AI Normalizer: Sync Language Models | Write `chatLanguageModels.json` from merged catalog |
| AI Normalizer: Export Active Profile | Save merged tool profiles JSON |
| AI Normalizer: Set Inline Chat Default Model | Set `inlineChat.defaultModel` |

Status bar (cloud icon): click to sync language models.

---

## Model cache file

Default location: extension global storage `models-cache.json`.

Shape:

```json
{
  "version": 1,
  "updatedAt": "2026-05-29T12:00:00.000Z",
  "endpoints": {
    "gemini-locked": {
      "fetchedAt": "2026-05-29T11:00:00.000Z",
      "sourceUrl": "https://your-proxy.example/v1/models",
      "models": [{ "id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro" }]
    }
  }
}
```

Override path with `aiNormalizer.modelCachePath`. Per-model tuning stays in **`aiNormalizer.modelOverrides`** (user settings), not in the cache file.

---

## Multiple VS Code windows

One **shared** proxy listens on `aiNormalizer.proxyPort` (default `3847`). Shared files: `chatLanguageModels.json`, extension `globalStorage` (`models-cache.json`, `proxy-config.json`).

- The **first** window to start the proxy owns the process (PID recorded in `proxy-owner.json`).
- **Additional** windows **attach** to the existing proxy, push config via `/admin/reload`, and do not spawn a second process.
- **Stop Proxy** in an attached window only detaches locally; it does not kill the shared proxy.
- **Closing** a window only stops the proxy if that window spawned it.

Run **Refresh Model Catalog** or **Sync Language Models** from any window after changing settings.

---

## Troubleshooting

| Problem | What to try |
|---------|-------------|
| Models missing in picker | **Refresh Model Catalog** → **Sync Language Models** → reload window |
| Model hidden in Agent mode | Set `toolCalling: true` in override or manual `models[]` |
| Discovery returns 0 models | Check `modelsUrl`, API key, Output channel logs; some gateways omit `/v1/models` — add manual `models[]` |
| Discovery 401/403 | **Set Endpoint API Key**; check Output for derived `modelsUrl` |
| Wrong models URL (`/v1/models` on v1beta) | Use full `…/chat/completions` upstream URL or set `discoverModels.modelsUrl` |
| Proxy binary not found | `pnpm run build` (populates `bin/`); auto-detect also checks `target/release` and `target/debug` under the extension folder |
| Proxy won't start (port in use) | Another window may already run the proxy — check Output for `Attaching to existing proxy`; or change `proxyPort` |
| Second window shows proxy failed | Reload extension build with attach support; ensure first window’s proxy is healthy on `/health` |
| Tools not invoked | If endpoint blocks tools, switch to `openai-pass-through` + `toolsPolicy: "strip"` + `toolCalling: false` override (chat-only mode) |
| Cursor vs Code path | Cache/sync uses `Cursor` or `Code` under `%APPDATA%` based on `vscode.env.appName` |
| Garbled Output logs | Update extension + proxy build (ANSI stripped when spawned from VS Code) |

---

## Limitations

| Surface | Support |
|---------|---------|
| Copilot Chat / Agent (BYOK) | Yes |
| Inline editor chat | Yes (BYOK model id) |
| Copilot ghost-text | No BYOK; optional extension FIM only |
| Cline / Continue sync | Planned (sync target registry); use same proxy URL manually for now |

---

## Proxy routes

| Route | Description |
|-------|-------------|
| `GET /health` | Health check |
| `GET /v1/models` | Models from merged config |
| `POST /v1/chat/completions` | Normalized chat |
| `POST /v1/completions` | Pass-through for inline FIM |
| `POST /admin/reload` | Hot-reload config |

---

## Development

The extension is **ESM** (`package.json` `"type": "module"`). TypeScript uses `moduleResolution: "bundler"` with **`.ts` import paths**; [esbuild](scripts/build-extension.mjs) bundles `src/extension.ts` → `dist/extension.js` (single file, `vscode` external).

```bash
pnpm run build         # proxy binary + esbuild extension bundle
pnpm run compile       # esbuild only
pnpm run watch         # esbuild --watch
pnpm run lint          # tsc --noEmit
pnpm run test          # Rust + TS (tsx) + proxy integration
pnpm run test:ts       # unit tests via tsx (no VS Code host)
pnpm run test:integration
```

Manual pre-publish checklist (Copilot BYOK, multi-window): [docs/TESTING.md](docs/TESTING.md).  
Releases, Marketplace, and Open VSX: [docs/PUBLISHING.md](docs/PUBLISHING.md).

## Security

AI Normalizer runs a **local native proxy** and handles **upstream API keys**. Please read [SECURITY.md](SECURITY.md) before installing in sensitive environments.

| Topic | Behavior |
|-------|----------|
| Network | Proxy binds to **loopback** by default (`aiNormalizer.proxyPort`, default `3847`). Do not forward this port to untrusted networks. |
| API keys | Stored in VS Code **SecretStorage** only — never in `settings.json` or synced `chatLanguageModels.json`. |
| Synced file | Updates `chatLanguageModels.json` with model metadata and `${input:chat.lm.secret.*}` placeholders, not raw keys. |
| Binaries | `normalizer-proxy` is built from this repo; release VSIXes are produced by [CI](.github/workflows/release.yml). |
| Reporting | Vulnerabilities: [GitHub Security Advisories](https://github.com/josh-hemphill/vscode-ai-normalizer/security/advisories/new) (see [SECURITY.md](SECURITY.md)). |

Review the **AI Normalizer** output channel when debugging; treat upstream keys like production credentials.

## License

MIT
