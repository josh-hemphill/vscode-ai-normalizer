# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - Unreleased

### Added

- Local OpenAI-compatible proxy with pluggable adapters (`openai-pass-through`, `inline-xml-tools`)
- Upstream model discovery with cache and per-model overrides
- Sync to `chatLanguageModels.json` for Copilot BYOK
- Endpoint API key commands (SecretStorage)
- Multi-window proxy attach and PID-based ownership
- Automated tests: TS unit, Rust unit, proxy HTTP integration
- CI workflow for tests and release artifacts

### Security

- Upstream API keys stored in VS Code SecretStorage only
- Synced models use `chat.lm.secret.*` placeholders, not literal keys
