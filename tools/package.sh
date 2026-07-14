#!/usr/bin/env bash
# Package the extension/ folder into a Chrome Web Store-ready zip.
# CWS requires manifest.json at the ROOT of the archive, not nested inside
# a parent folder — this zips the CONTENTS of extension/, not extension/
# itself, which is the easy way to get that wrong.
#
#   tools/package.sh
#
# Output: dist/dense-<version>.zip (dist/ is gitignored; each run replaces
# any existing zip for that version).
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -e "console.log(require('./extension/manifest.json').version)")
OUT_DIR="dist"
OUT_FILE="$OUT_DIR/dense-$VERSION.zip"

mkdir -p "$OUT_DIR"
rm -f "$OUT_FILE"

cd extension
zip -r -X "../$OUT_FILE" . -x ".*"
cd ..

echo ""
echo "Packaged: $OUT_FILE"
echo ""
echo "Verifying manifest.json sits at the zip root:"
unzip -l "$OUT_FILE" | grep -E "manifest\.json$" || {
  echo "ERROR: manifest.json not found at zip root!" >&2
  exit 1
}
