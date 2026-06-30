#!/usr/bin/env bash
# Format-on-save hook for Claude Code.
# Reads the tool-use payload from stdin (JSON), extracts the edited file path,
# and runs Prettier on it if it's a TS/JS/JSON/MD file.
#
# Silent on success. Prints to stderr on failure so Claude sees the message
# but the tool result is unaffected.

set -euo pipefail

# Read JSON payload from stdin. Claude Code passes tool_input here.
PAYLOAD="$(cat || true)"

# Extract file_path with jq if available, otherwise a grep fallback.
if command -v jq >/dev/null 2>&1; then
  FILE_PATH="$(printf '%s' "$PAYLOAD" | jq -r '.tool_input.file_path // empty')"
else
  FILE_PATH="$(printf '%s' "$PAYLOAD" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]+"' | head -1 | sed -E 's/.*"file_path"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')"
fi

if [[ -z "${FILE_PATH:-}" ]] || [[ ! -f "$FILE_PATH" ]]; then
  exit 0
fi

case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.md|*.css)
    if command -v pnpm >/dev/null 2>&1 && [[ -f "package.json" ]]; then
      pnpm exec prettier --write --log-level=warn "$FILE_PATH" 2>&1 || {
        echo "[format-on-save] prettier failed on $FILE_PATH" >&2
        exit 0  # don't block the tool; just warn
      }
    fi
    ;;
  *)
    # Not a file Prettier cares about.
    ;;
esac

exit 0
