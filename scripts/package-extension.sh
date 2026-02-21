#!/usr/bin/env bash
set -euo pipefail

SOURCE_DIR="${1:-dist}"
PACKAGE_DIR="${2:-artifacts/extension}"
ZIP_PATH="${3:-}"
ROOT_DIR="$(pwd)"

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

echo "Package prepared: $PACKAGE_DIR"

if [ -n "$ZIP_PATH" ]; then
  case "$ZIP_PATH" in
    /*) ABS_ZIP_PATH="$ZIP_PATH" ;;
    *) ABS_ZIP_PATH="$ROOT_DIR/$ZIP_PATH" ;;
  esac

  mkdir -p "$(dirname "$ABS_ZIP_PATH")"

  (
    cd "$PACKAGE_DIR"
    zip -r "$ABS_ZIP_PATH" .
  )

  echo "Package zipped: $ABS_ZIP_PATH"
fi
