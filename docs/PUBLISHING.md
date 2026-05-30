# Publishing

Extensions are published to the [Visual Studio Marketplace](https://marketplace.visualstudio.com/) under publisher **jo-hemphill**.

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
   npx @vscode/vsce publish -i vscode-ai-normalizer.vsix -p "$VSCE_PAT" --pre-release
   ```

## Local VSIX smoke

```bash
pnpm run build
# Or use release artifact layout — see docs/TESTING.md
npx @vscode/vsce package --pre-release --out vscode-ai-normalizer.vsix
npx @vscode/vsce ls
```

Confirm `bin/**/normalizer-proxy*`, `dist/extension.js`, and `CHANGELOG.md` are included; `src/`, `target/`, and `crates/` are not.

## Cross-platform binaries

The release workflow builds `win32-x64`, `darwin-x64`, `darwin-arm64`, and `linux-x64`. See [TESTING.md](TESTING.md) for multi-window and BYOK manual checks before removing `--pre-release`.
