# Publishing

Extension ID: **[jo-hemphill.ai-endpoint-normalizer](https://marketplace.visualstudio.com/items?itemName=jo-hemphill.ai-endpoint-normalizer)** (display name: **AI Endpoint Normalizer**).

Also published to [Open VSX](https://open-vsx.org/) for VSCodium and other clients that use that registry.

## Pre-release policy

CI publishes with **`--pre-release`** until you remove that flag for a stable release. In VS Code/Cursor, enable **Pre-release** when installing from the Marketplace.

## GitHub Actions secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `VSCE_PAT` | Yes (for Marketplace publish) | Azure DevOps PAT with **Marketplace → Manage** |
| `OVSX_PAT` | Yes (for Open VSX publish) | Token from [open-vsx.org](https://open-vsx.org) user settings |
| `VSIX_SIGNING_PFX_BASE64` | No | Base64-encoded code-signing `.pfx` |
| `VSIX_SIGNING_PFX_PASSWORD` | No | PFX password (required when PFX secret is set) |

### First-time Open VSX

```bash
npx ovsx create-namespace jo-hemphill -p "$OVSX_PAT"
```

### Optional: VSIX signing

Marketplace accepts **unsigned** extensions. Signing requires a commercial code-signing certificate exported as PFX.

1. Encode the certificate: `base64 -w0 signing.pfx` (Linux) or equivalent
2. Add secrets `VSIX_SIGNING_PFX_BASE64` and `VSIX_SIGNING_PFX_PASSWORD`
3. CI uses [`scripts/sign-extension-manifest.sh`](../scripts/sign-extension-manifest.sh) as `vsce publish --signTool` (manifest → `.p7s` via OpenSSL)
4. Verify locally after first setup: `vsce verify-signature -i ai-endpoint-normalizer.vsix -m … -s …`

If signing secrets are absent, [`scripts/publish-marketplace.sh`](../scripts/publish-marketplace.sh) publishes **unsigned**.

**Alternative:** [Azure Trusted Signing](https://devblogs.microsoft.com/visualstudio/sign-vsix-packages-with-sign-cli/) (not wired in CI yet).

### GitHub environment `marketplace`

The `publish-registries` job uses environment **`marketplace`**. In repo **Settings → Environments**, create it and optionally require reviewers before publish runs.

## Release flow

1. **Prepare** — bumps `package.json`, finalizes `CHANGELOG.md`:

   ```bash
   pnpm run release:prep 0.2.0
   ```

   Or **Actions → Release prep** (`workflow_dispatch`).

2. **Review** changelog and version; merge.

3. **Tag and push:**

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. **CI** ([`.github/workflows/release.yml`](../.github/workflows/release.yml)):
   - Builds cross-platform `bin/<platform>-<arch>/`
   - Packages `ai-endpoint-normalizer.vsix` (pre-release)
   - GitHub Release with changelog body
   - **`publish-registries`:** Marketplace (+ optional signing) and Open VSX

## Manual publish (fallback)

```bash
pnpm run build
npx @vscode/vsce package --pre-release --out ai-endpoint-normalizer.vsix
export VSCE_PAT=…
bash scripts/publish-marketplace.sh ai-endpoint-normalizer.vsix
npx ovsx publish ai-endpoint-normalizer.vsix -p "$OVSX_PAT" --pre-release
```

## Local VSIX smoke

`vscode:prepublish` is **compile only** (no Rust). Lay out or build binaries first:

```bash
pnpm run build
npx @vscode/vsce package --pre-release --out ai-endpoint-normalizer.vsix
npx @vscode/vsce ls
```

Confirm `bin/<platform>-<arch>/`, `dist/extension.js`, and `CHANGELOG.md` are included.

## Cross-platform binaries

Release matrix: `win32-x64`, `darwin-x64`, `darwin-arm64`, `linux-x64`. See [TESTING.md](TESTING.md) for manual BYOK and multi-window checks before dropping `--pre-release`.
