#!/usr/bin/env bash
# Signs a VS Code extension manifest for vsce publish (--signTool).
# Usage: sign-extension-manifest.sh <manifest.json> <signature.p7s>
set -euo pipefail

MANIFEST="${1:?manifest path required}"
SIGOUT="${2:?signature output path required}"
PFX="${VSIX_SIGNING_PFX_PATH:-/tmp/vsix-signing.pfx}"
PASS="${VSIX_SIGNING_PFX_PASSWORD:-}"

if [[ ! -f "$PFX" ]]; then
  echo "sign-extension-manifest: PFX not found at $PFX" >&2
  exit 1
fi

KEY="$(mktemp)"
CERT="$(mktemp)"
trap 'rm -f "$KEY" "$CERT"' EXIT

openssl pkcs12 -in "$PFX" -passin "pass:${PASS}" -nocerts -nodes -out "$KEY"
openssl pkcs12 -in "$PFX" -passin "pass:${PASS}" -clcerts -nokeys -out "$CERT"
openssl smime -sign \
  -in "$MANIFEST" \
  -out "$SIGOUT" \
  -signer "$CERT" \
  -inkey "$KEY" \
  -outform DER \
  -nodetach

echo "sign-extension-manifest: wrote $SIGOUT"
