#!/usr/bin/env bash
# sync-hooks.sh — distribute the canonical crew hooks to every fleet repo.
#
# The mechanism most multi-repo setups never have. It is easy to name an exact source file for
# a doc and then say only "install the hooks" in prose for the executable half. That asymmetry
# is how guard.sh came to exist in three different versions in the fleet this kit came from,
# each holding a lesson the other repos never received.
#
#   ./sync-hooks.sh [fleet-root] --dry-run    show what would change (writes NOTHING)
#   ./sync-hooks.sh [fleet-root]              write, then VERIFY every file it wrote
#
# fleet-root defaults to the parent of this kit checkout (repos as siblings of brain-kit).
# A single repo is better served by `agent-brain-kit setup <dir>`, which also wires settings.
#
# WHICH REPOS. Every directory under fleet-root that is a git checkout with a .claude/ — EXCEPT:
#   - a repo with .claude/.no-crew-hooks (it keeps a .claude/ for its own CLAUDE.md but
#     deliberately does not run the crew kit; without this marker, "has a .claude" silently
#     meant "wants every hook");
#   - a git WORKTREE (its .git is a FILE). A worktree is another session's live work; its
#     changes reach the main checkout by commit and merge, never by a sync writing into it.
# The write pass and the verify pass use ONE predicate (should_sync), because an earlier
# version honoured the opt-out when writing and ignored it when verifying — and reported a
# MISMATCH for a file nobody intended to write. That is how the divergence was found.
#
# Line endings are normalised to LF on write: a CRLF `#!/usr/bin/env bash` is "bad interpreter"
# on Linux, and a Windows checkout with core.autocrlf=true hands you CRLF everywhere.
set -uo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$KIT/hooks"
ROOT="${1:-$(cd "$KIT/.." && pwd)}"; [ "${ROOT:0:2}" = "--" ] && ROOT="$(cd "$KIT/.." && pwd)"
DRY=""; for a in "$@"; do [ "$a" = "--dry-run" ] && DRY=1; done

# Distributed to every repo. client-data-scan.sh is NOT here: it is an opt-in extra that only
# repos handling client data wire as a git pre-commit hook, and it is left alone where present.
CORE="_json.sh brain-check.sh format.sh guard.sh notify.sh secret-scan.sh subagent-gate.sh"

# should_sync DIR → 0 if DIR is a target; otherwise prints why not and returns 1.
should_sync() {
  local d="$1"
  [ -f "$d/.git" ] && { echo "worktree"; return 1; }
  [ -d "$d/.git" ] || { echo "not a git repo"; return 1; }
  [ -d "$d/.claude" ] || { echo "no .claude/"; return 1; }
  [ -f "$d/.claude/.no-crew-hooks" ] && { echo ".no-crew-hooks"; return 1; }
  return 0
}

changed=0; same=0; skipped=0
for d in "$ROOT"/*/; do
  d="${d%/}"; r="$(basename "$d")"
  [ -e "$d/.git" ] || continue   # not a repo at all: not worth a line
  if ! why="$(should_sync "$d")"; then
    skipped=$((skipped+1)); printf "  %-6s %s (%s)\n" "SKIP" "$r" "$why"; continue
  fi
  # A DRY RUN WRITES NOTHING — not even a directory. This mkdir used to run unconditionally, so
  # `--dry-run` created an empty .claude/hooks/ in any repo lacking one. Found by a unit test.
  [ -n "$DRY" ] || mkdir -p "$d/.claude/hooks"
  for f in $CORE; do
    tgt="$d/.claude/hooks/$f"
    # CONTENT comparison, line endings ignored, DELIBERATELY. A Windows checkout with
    # core.autocrlf=true is CRLF in the worktree and LF in the blob; a byte-exact compare
    # reports every file as drifted when git itself sees no change.
    if [ -f "$tgt" ] && [ -z "$(diff <(tr -d '\r' < "$SRC/$f") <(tr -d '\r' < "$tgt") 2>/dev/null)" ]; then
      same=$((same+1)); continue
    fi
    state="UPDATE"; [ -f "$tgt" ] || state="ADD"
    if [ -n "$DRY" ]; then printf "  %-6s %s/%s\n" "$state" "$r" "$f"
    else tr -d '\r' < "$SRC/$f" > "$tgt" && chmod +x "$tgt" && printf "  %-6s %s/%s\n" "$state" "$r" "$f"; fi
    changed=$((changed+1))
  done
done

echo "--------------------------------------------------------------"
if [ -n "$DRY" ]; then
  echo "dry run: $changed would change, $same already canonical, $skipped repos skipped"; exit 0
fi

# VERIFY WHAT WAS WRITTEN. A sync that reports success without re-reading the target is the
# same class of defect as a gate that skips silently — and this kit has already shipped one
# restore script that wrote nothing and exited 0.
bad=0
for d in "$ROOT"/*/; do
  d="${d%/}"; r="$(basename "$d")"
  [ -e "$d/.git" ] || continue
  should_sync "$d" >/dev/null || continue
  for f in $CORE; do
    diff <(tr -d '\r' < "$SRC/$f") <(tr -d '\r' < "$d/.claude/hooks/$f") >/dev/null 2>&1 \
      || { echo "  VERIFY FAILED: $r/$f" >&2; bad=$((bad+1)); }
  done
done
echo "$changed written, $same already canonical; verification: $([ $bad -eq 0 ] && echo 'all match' || echo "$bad MISMATCH")"
[ $bad -eq 0 ] || exit 1
exit 0
