# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Marketplace extension ID renamed to `jo-hemphill.ai-endpoint-normalizer` (display name: AI Endpoint Normalizer)

### Added

- Release CI publishes pre-release VSIX to Visual Studio Marketplace and Open VSX (optional manifest signing via PFX secrets)
- `additionalSystemPrompts` on `aiNormalizer.profiles` for `inline-xml-tools` endpoints
- `chat-only` built-in profile and `toolsPolicy` endpoint mode (`forward` / `strip`) for tool-blocked upstreams
- `modelOverrides` passthrough of extra model fields (for example `thinking`, `streaming`) into synced `chatLanguageModels.json`

### Fixed

### Security

## [0.1.0] - 2026-05-29

### Added

- Local OpenAI-compatible proxy with pluggable adapters (`openai-pass-through`, `inline-xml-tools`)
- Upstream model discovery with cache and per-model overrides
- Sync to `chatLanguageModels.json` for Copilot BYOK
- Endpoint API key commands (SecretStorage) and Getting Started walkthrough
- Multi-window proxy attach, empty-catalog sync guards, and PID-based ownership
- Status bar setup guidance (add endpoint, set API key)
- Automated tests: TS unit, Rust unit, proxy HTTP integration
- CI and tag-based release workflow with cross-platform proxy binaries

### Security

- Upstream API keys stored in VS Code SecretStorage only
- Synced models use `chat.lm.secret.*` placeholders, not literal keys
- Localhost-only proxy by default (`127.0.0.1`)
