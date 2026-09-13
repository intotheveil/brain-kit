#!/usr/bin/env bash
# sync-hooks.sh — distribute the canonical crew hooks to every fleet repo.
#
# The mechanism most multi-repo setups never have. It is easy to name an exact source file for
# a doc and then say only "install the hooks" in prose for the executable half. That asymmetry
# is how guard.sh came to exist in three different versions in the fleet this kit came from,
# each holding a lesson the other repos never received.
#
#   ./sync-hooks.sh [fleet-root] --dry-run    show what would change
#   ./sync-hooks.sh [fleet-root]              write, then VERIFY every file it wrote
#
# Line endings are normalised to LF on write: a CRLF `#!/usr/bin/env bash` is "bad interpreter"
# on Linux, and this desktop checks everything out as CRLF.
set -uo pipefail
KIT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$KIT/hooks"
ROOT="${1:-$(cd "$KIT/.." && pwd)}"; [ "${ROOT:0:2}" = "--" ] && ROOT="$(cd "$KIT/.." && pwd)"
DRY=""; for a in "$@"; do [ "$a" = "--dry-run" ] && DRY=1; done

# Distributed to every repo. client-data-scan.sh is NOT here: it is an opt-in extra that only
# repos handling client data wire as a git pre-commit hook, and it is left alone where present.
CORE="_json.sh brain-check.sh format.sh guard.sh notify.sh secret-scan.sh subagent-gate.sh"

changed=0; same=0; skipped=0
for d in "$ROOT"/*/; do
  r="$(basename "$d")"
  [ -d "$d/.git" ] || continue
  [ -d "$d/.claude" ] || { skipped=$((skipped+1)); continue; }
  mkdir -p "$d/.claude/hooks"
  for f in $CORE; do
    tgt="$d/.claude/hooks/$f"
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
  r="$(basename "$d")"; [ -d "$d/.git" ] && [ -d "$d/.claude" ] || continue
  for f in $CORE; do
    diff <(tr -d '\r' < "$SRC/$f") <(tr -d '\r' < "$d/.claude/hooks/$f") >/dev/null 2>&1 \
      || { echo "  VERIFY FAILED: $r/$f" >&2; bad=$((bad+1)); }
  done
done
echo "$changed written, $same already canonical; verification: $([ $bad -eq 0 ] && echo 'all match' || echo "$bad MISMATCH")"
[ $bad -eq 0 ] || exit 1
exit 0
