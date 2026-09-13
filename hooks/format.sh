#!/usr/bin/env bash
# PostToolUse (Write|Edit). Auto-formats the written file. Non-blocking.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_json.sh"
INPUT="$(cat)"
FILE="$(printf '%s' "$INPUT" | jget '.tool_input.file_path')"
[ -z "$FILE" ] && FILE="$(printf '%s' "$INPUT" | jget '.inputs.file_path')"
[ -z "$FILE" ] && exit 0
[ -f "$FILE" ] || exit 0
case "$FILE" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
    command -v npx >/dev/null 2>&1 && npx --no-install prettier --write "$FILE" >/dev/null 2>&1 || true ;;
esac
exit 0
