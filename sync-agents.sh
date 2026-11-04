#!/usr/bin/env bash
# sync-agents.sh — distribute the canonical crew agents (agents/*.md) to every fleet repo.
#
# The agents were the last part of the crew kit with NO named source in the fleet this kit
# came from: "the crew agents, byte-identical in every repo" was a property the fleet happened
# to have, kept by copying from whichever repo was handy — the same prose-as-distribution that
# produced three guard.sh variants. agents/ is the source; this script is how it reaches repos.
#
#   ./sync-agents.sh [fleet-root] --dry-run    show what would change (writes NOTHING)
#   ./sync-agents.sh [fleet-root]              write, then VERIFY every file it wrote
#
# Targets: the same predicate as sync-hooks.sh — a git checkout under fleet-root with a
# .claude/, not a worktree, no .claude/.no-crew-hooks. A single repo is better served by
# `agent-brain-kit setup <dir>`.
#
# A REPO MAY KEEP ITS OWN VERSION of an agent: list the file names (e.g. `qa.md`), one per line,
# in .claude/.keep-agents. A kept agent is reported KEPT and never overwritten. Files in a
# repo's .claude/agents/ that the kit does not ship are never touched or deleted. A fork you
# wrote down is a decision; a fork you didn't is drift.
#
# Content comparison ignores CR, and writes are LF, for the reason sync-hooks.sh gives.
set -uo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$KIT/agents"
ROOT="${1:-$(cd "$KIT/.." && pwd)}"; [ "${ROOT:0:2}" = "--" ] && ROOT="$(cd "$KIT/.." && pwd)"
DRY=""; for a in "$@"; do [ "$a" = "--dry-run" ] && DRY=1; done

AGENTS=""
for f in "$SRC"/*.md; do [ -f "$f" ] && AGENTS="$AGENTS $(basename "$f")"; done
# An empty source must never read as "nothing to do, all canonical".
[ -n "$AGENTS" ] || { echo "INCONCLUSIVE: no agents in $SRC" >&2; exit 2; }

should_sync() {
  local d="$1"
  [ -f "$d/.git" ] && { echo "worktree"; return 1; }
  [ -d "$d/.git" ] || { echo "not a git repo"; return 1; }
  [ -d "$d/.claude" ] || { echo "no .claude/"; return 1; }
  [ -f "$d/.claude/.no-crew-hooks" ] && { echo ".no-crew-hooks"; return 1; }
  return 0
}
# is_kept DIR FILE → 0 if the repo declared FILE in .claude/.keep-agents.
is_kept() { [ -f "$1/.claude/.keep-agents" ] && tr -d '\r' < "$1/.claude/.keep-agents" | grep -qxF "$2"; }

changed=0; same=0; kept=0; skipped=0
for d in "$ROOT"/*/; do
  d="${d%/}"; r="$(basename "$d")"
  [ -e "$d/.git" ] || continue
  if ! why="$(should_sync "$d")"; then
    skipped=$((skipped+1)); printf "  %-6s %s (%s)\n" "SKIP" "$r" "$why"; continue
  fi
  [ -n "$DRY" ] || mkdir -p "$d/.claude/agents"
  for f in $AGENTS; do
    if is_kept "$d" "$f"; then printf "  %-6s %s/%s (repo's own — .keep-agents)\n" "KEPT" "$r" "$f"; kept=$((kept+1)); continue; fi
    tgt="$d/.claude/agents/$f"
    if [ -f "$tgt" ] && [ -z "$(diff <(tr -d '\r' < "$SRC/$f") <(tr -d '\r' < "$tgt") 2>/dev/null)" ]; then
      same=$((same+1)); continue
    fi
    state="UPDATE"; [ -f "$tgt" ] || state="ADD"
    if [ -n "$DRY" ]; then printf "  %-6s %s/%s\n" "$state" "$r" "$f"
    else tr -d '\r' < "$SRC/$f" > "$tgt" && printf "  %-6s %s/%s\n" "$state" "$r" "$f"; fi
    changed=$((changed+1))
  done
done

echo "--------------------------------------------------------------"
if [ -n "$DRY" ]; then
  echo "dry run: $changed would change, $same already canonical, $kept kept, $skipped repos skipped"; exit 0
fi

# VERIFY WHAT WAS WRITTEN — re-read every target, same predicate as the write pass.
bad=0
for d in "$ROOT"/*/; do
  d="${d%/}"; r="$(basename "$d")"
  [ -e "$d/.git" ] || continue
  should_sync "$d" >/dev/null || continue
  for f in $AGENTS; do
    is_kept "$d" "$f" && continue
    diff <(tr -d '\r' < "$SRC/$f") <(tr -d '\r' < "$d/.claude/agents/$f") >/dev/null 2>&1 \
      || { echo "  VERIFY FAILED: $r/$f" >&2; bad=$((bad+1)); }
  done
done
echo "$changed written, $same already canonical, $kept kept; verification: $([ $bad -eq 0 ] && echo 'all match' || echo "$bad MISMATCH")"
[ $bad -eq 0 ] || exit 1
exit 0
