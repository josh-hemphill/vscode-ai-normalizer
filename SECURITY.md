# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| Latest pre-release on Marketplace / GitHub Releases | Yes |
| Older VSIX versions | Best effort |

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

1. Open a [private security advisory](https://github.com/josh-hemphill/vscode-ai-normalizer/security/advisories/new) on GitHub, or
2. Contact the maintainer via the email listed on the Marketplace publisher profile.

We aim to acknowledge reports within a few business days.

## Threat model (summary)

AI Normalizer is a **local development tool**:

- A **native proxy** listens on **loopback** by default (`127.0.0.0.1`, port configurable via `aiNormalizer.proxyPort`).
- **Upstream API keys** are stored in VS Code **SecretStorage**, not in `settings.json` or synced `chatLanguageModels.json`.
- The extension **writes** `chatLanguageModels.json` under your editor user folder; it does not send keys to Microsoft except through normal Copilot BYOK flows you configure.
- Shipped **binaries** are built from this repository’s Rust crate (`normalizer-proxy`); review CI release artifacts if you need reproducibility.

## User responsibilities

- Do not expose the proxy port beyond your machine or shared networks you do not trust.
- Treat upstream API keys like production secrets.
- Review the **AI Normalizer** output channel and proxy logs when debugging.
- Install VSIX only from this project’s GitHub Releases or the official Marketplace listing.

## Dependency updates

Security fixes for Rust and Node dependencies are applied via routine maintenance PRs; release tags trigger rebuilt proxy binaries and VSIX artifacts.
