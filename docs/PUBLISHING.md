# Publishing

Extensions are published to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=jo-hemphill.ai-endpoint-normalizer) as **jo-hemphill.ai-endpoint-normalizer** (display name: AI Normalizer).

## Pre-release policy

Until the first stable release, CI builds and marketplace uploads use **`--pre-release`**. Install from the marketplace with **Pre-release** enabled, or install the VSIX from GitHub Releases.

## Release flow

1. **Prepare** (bumps `package.json`, finalizes `CHANGELOG.md` from `[Unreleased]` + commits since last tag):

   ```bash
   pnpm run release:prep -- 0.2.0
   ```

   Or run the **Release prep** GitHub Actions workflow (`workflow_dispatch`) with the same version.

2. **Review** the PR/commit: changelog section, version, tests green.

3. **Tag and push**:

   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. **CI** (`.github/workflows/release.yml`) builds cross-platform `bin/`, packages a pre-release VSIX, and creates a GitHub Release whose **body** is the matching `CHANGELOG.md` section (not auto-generated commit notes).

5. **Publish to Marketplace** (manual until `VSCE_PAT` is wired in CI):

   ```bash
   npx @vscode/vsce publish -i ai-endpoint-normalizer.vsix -p "$VSCE_PAT" --pre-release
   ```

## Local VSIX smoke

`vscode:prepublish` runs **esbuild only** (no Rust). Build or lay out proxy binaries before packaging:

```bash
pnpm run build
# Or: node scripts/layout-release-binaries.mjs artifacts  (after CI artifacts)
npx @vscode/vsce package --pre-release --out ai-endpoint-normalizer.vsix
npx @vscode/vsce ls
```

Release CI lays out `bin/<platform>-<arch>/` from matrix artifacts; `vsce package` does not run `cargo build`.

Confirm `bin/**/normalizer-proxy*`, `dist/extension.js`, and `CHANGELOG.md` are included; `src/`, `target/`, and `crates/` are not.

## Cross-platform binaries

The release workflow builds `win32-x64`, `darwin-x64`, `darwin-arm64`, and `linux-x64`. See [TESTING.md](TESTING.md) for multi-window and BYOK manual checks before removing `--pre-release`.
