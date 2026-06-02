#!/usr/bin/env bash
# Publishes ai-endpoint-normalizer.vsix to the Visual Studio Marketplace.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VSIX="${1:-$ROOT/ai-endpoint-normalizer.vsix}"

if [[ ! -f "$VSIX" ]]; then
  echo "publish-marketplace: VSIX not found: $VSIX" >&2
  exit 1
fi

if [[ -z "${VSCE_PAT:-}" ]]; then
  echo "publish-marketplace: VSCE_PAT is not set" >&2
  exit 1
fi

SIGN_TOOL="$ROOT/scripts/sign-extension-manifest.sh"
chmod +x "$SIGN_TOOL"

PUBLISH_ARGS=(
  publish
  -i "$VSIX"
  -p "$VSCE_PAT"
  --pre-release
)

if [[ -n "${VSIX_SIGNING_PFX_BASE64:-}" ]]; then
  echo "publish-marketplace: signing enabled"
  echo "$VSIX_SIGNING_PFX_BASE64" | base64 -d > /tmp/vsix-signing.pfx
  export VSIX_SIGNING_PFX_PATH=/tmp/vsix-signing.pfx
  export VSIX_SIGNING_PFX_PASSWORD="${VSIX_SIGNING_PFX_PASSWORD:-}"
  PUBLISH_ARGS+=(--signTool "$SIGN_TOOL")
else
  echo "publish-marketplace: VSIX_SIGNING_PFX_BASE64 not set; publishing unsigned"
fi

vsce "${PUBLISH_ARGS[@]}"
echo "publish-marketplace: done"
