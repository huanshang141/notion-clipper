#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-dist}"
PACKAGE_DIR="${2:-artifacts/extension}"
ZIP_PATH="${3:-artifacts/extension.zip}"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Package failed: source directory '$SOURCE_DIR' not found"
  exit 1
fi

mkdir -p "$PACKAGE_DIR"
cp -R "$SOURCE_DIR"/. "$PACKAGE_DIR"/

find "$PACKAGE_DIR" -type f \( -name "*.map" -o -name "*.d.ts" -o -name "*.d.ts.map" \) -delete

if [ ! -f "$PACKAGE_DIR/manifest.json" ]; then
  echo "Package failed: manifest.json not found in package root"
  exit 1
fi

mkdir -p "$(dirname "$ZIP_PATH")"
(
  cd "$PACKAGE_DIR"
  zip -r "$(realpath "$ZIP_PATH")" .
)

echo "Package created: $ZIP_PATH"
