#!/usr/bin/env bash
# Generates a throwaway self-signed PAdES signing certificate for local
# development (implementation.md §8.3, §10 P8). Adobe/other viewers will
# show "identity not verified" for this certificate — expected, and
# documented in §8.3 as the known limitation of a dev cert. The production
# upgrade path (Class 3 DSC on USB token, an eSign provider, or an HSM via
# PKCS#11) is deliberately not built here — §8.3 says "document only."
#
# Usage: bash scripts/gen-dev-cert.sh [output-dir]
#   output-dir defaults to ./certs (matches .env.example's SIGNING_P12_PATH).
set -euo pipefail

OUT_DIR="${1:-./certs}"
P12_PASSWORD="${SIGNING_P12_PASSWORD:-tula}"
DAYS=3650

mkdir -p "$OUT_DIR"

KEY_PATH="$OUT_DIR/dev-signing.key"
CERT_PATH="$OUT_DIR/dev-signing.crt"
P12_PATH="$OUT_DIR/dev-signing.p12"

if [ -f "$P12_PATH" ]; then
  echo "gen-dev-cert: $P12_PATH already exists — remove it first to regenerate." >&2
  exit 1
fi

echo "gen-dev-cert: generating a 4096-bit RSA key and a $DAYS-day self-signed certificate..."
openssl req -x509 -newkey rsa:4096 -sha256 -days "$DAYS" -nodes \
  -keyout "$KEY_PATH" -out "$CERT_PATH" \
  -subj "/C=IN/O=Tula Development/OU=RRSL (dev)/CN=Tula Dev Signing Certificate"

echo "gen-dev-cert: bundling into a PKCS#12 (.p12) file..."
openssl pkcs12 -export \
  -inkey "$KEY_PATH" -in "$CERT_PATH" \
  -out "$P12_PATH" -passout "pass:$P12_PASSWORD" \
  -name "Tula Dev Signing Certificate"

# The bare key/cert are only intermediates on the way to the .p12; keeping
# them around is one more place a private key could leak from by accident.
rm -f "$KEY_PATH" "$CERT_PATH"

echo "gen-dev-cert: wrote $P12_PATH"
echo "gen-dev-cert: set SIGNING_P12_PATH=$P12_PATH and SIGNING_P12_PASSWORD=$P12_PASSWORD in .env"
