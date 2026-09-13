#!/usr/bin/env bash
# Client-data commit scan. Blocks a commit whose STAGED diff ADDS client data or a client identifier
# (names / vendors / amounts). Runs as the git pre-commit hook (authoritative: sees the exact staged
# content at commit time, so it catches add+commit-in-one-shot and human commits too). Also invoked
# by the PreToolUse guard for earlier agent feedback. Only ADDED ('+') lines are scanned, so a
# REDACTION commit that REMOVES a leaked value is never blocked. Denylist lives in the gitignored
# .claude/.client-denylist (so this committed script carries no client tokens). Exit non-zero blocks.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
ADDED="$(git diff --cached 2>/dev/null | grep -E '^\+' || true)"
[ -z "$ADDED" ] && exit 0

# (a) Greek script in added lines = almost certainly raw client data in this English repo.
if printf '%s' "$ADDED" | grep -Pq '[\x{0370}-\x{03FF}]' 2>/dev/null; then
  echo "client-data-scan: Greek characters in the staged diff — looks like raw client data. Redact/synthesize before committing." >&2
  exit 1
fi

# (b) denylist of known client identifiers (gitignored, local-only; one extended-regex per line).
DENY="$ROOT/.claude/.client-denylist"
if [ -s "$DENY" ]; then
  PATS="$(grep -vE '^[[:space:]]*(#|$)' "$DENY" || true)"
  if [ -n "$PATS" ] && printf '%s' "$ADDED" | grep -Eq -f <(printf '%s' "$PATS") 2>/dev/null; then
    echo "client-data-scan: staged diff contains a denylisted client identifier (see .claude/.client-denylist). Redact/synthesize before committing." >&2
    exit 1
  fi
fi
exit 0
