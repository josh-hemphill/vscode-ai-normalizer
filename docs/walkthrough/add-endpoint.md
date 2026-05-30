# Add an upstream endpoint

AI Normalizer routes Copilot Chat through a **local proxy** on `127.0.0.1`, then forwards to your API.

## Fast path

1. Run **AI Normalizer: Add First Endpoint** from the Command Palette.
2. Pick **Gemini**, **OpenRouter**, or paste a **custom** chat completions URL.
3. Review `aiNormalizer.endpoints` in Settings if you need XML tool translation (`inline-xml-tools`).

## Example (Gemini)

```json
{
  "id": "gemini",
  "displayName": "Gemini",
  "upstreamUrl": "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  "adapter": "openai-pass-through",
  "discoverModels": { "enabled": true }
}
```

Do **not** put API keys in this JSON — use **Set Endpoint API Key** next.
