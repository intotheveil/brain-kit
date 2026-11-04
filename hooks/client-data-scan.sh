#!/usr/bin/env bash
# Client-data commit scan. Blocks a commit whose STAGED diff ADDS client data or a client identifier
# (names / vendors / amounts). Runs as the git pre-commit hook (authoritative: sees the exact staged
# content at commit time, so it catches add+commit-in-one-shot and human commits too). Also invoked
# by the PreToolUse guard for earlier agent feedback. Only ADDED ('+') lines are scanned, so a
# REDACTION commit that REMOVES a leaked value is never blocked. Denylist lives in the gitignored
# .claude/.client-denylist (so this committed script carries no client tokens). Exit non-zero blocks.
set -uo pipefail
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
# Binary content is not client text and its bytes can spell anything (a .glb matched the Greek
# range in a game repo, 2026-09-27): numstat's `-<TAB>-` rows are excluded by pathspec — see guard.sh.
BIN_EXCL=()
while IFS=$'\t' read -r -d '' nadd ndel npath; do
  [ "$nadd" = - ] && [ "$ndel" = - ] && BIN_EXCL+=(":(exclude,literal)$npath")
done < <(git -C "$ROOT" diff --cached --numstat -z --no-renames 2>/dev/null || true)
ADDED="$(git -C "$ROOT" diff --cached -- . ${BIN_EXCL[@]+"${BIN_EXCL[@]}"} 2>/dev/null | grep -aE '^\+' | tr -d '\000' || true)"
# `grep -a` is load-bearing: without it one NUL in the diff text replaces ALL added lines with
# "Binary file (standard input) matches" and both rules below scan nothing (see guard.sh).
[ -z "$ADDED" ] && exit 0

# (a) Greek script in added lines = almost certainly raw client data in this English repo — unless
# the repo ships Greek on purpose: `.claude/.no-greek-scan` turns off (a) only; (b) still runs.
if [ ! -f "$ROOT/.claude/.no-greek-scan" ] && printf '%s' "$ADDED" | grep -Pq '[\x{0370}-\x{03FF}]' 2>/dev/null; then
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
