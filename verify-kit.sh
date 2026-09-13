#!/usr/bin/env bash
# verify-kit.sh — fleet kit integrity check. READ-ONLY: never writes to a repo.
#
# Two checks, both of which have already caught live breakage:
#
#   1. SECTION REFERENCES. The crew agents are identical in every repo and cite
#      CLAUDE.md sections BY NUMBER ("the rubric in CLAUDE.md §6"). That makes the
#      numbering a contract between the kit's two halves. A repo whose CLAUDE.md
#      lacks a cited section does not fail loudly — the agent invents a rubric and
#      grades on vibes. This check makes that a hard FAIL.
#
#   2. KIT DRIFT. Compares every kit file against the fleet mode (the most common
#      content across all repos) and names the outliers. Hashes are computed on
#      CR-STRIPPED content: a Windows checkout makes every file CRLF, and comparing
#      raw bytes reports drift that does not exist. (Learned the hard way — the
#      first pass of this audit misread one repo as a total fork.)
#
# Verdicts are three-valued, never two: PASS / FAIL / INCONCLUSIVE. "Could not
# check" must never collapse into either pass or fail.
#
# Usage: verify-kit.sh [fleet-root]      (default: the parent of this kit checkout)
set -uo pipefail

ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
KIT_FILES_HOOKS="_json.sh brain-check.sh format.sh guard.sh notify.sh secret-scan.sh subagent-gate.sh"
KIT_FILES_AGENTS="builder.md explore.md planner.md qa.md reviewer.md test-writer.md"

hash_norm() { tr -d '\r' < "$1" 2>/dev/null | md5sum | cut -c1-8; }

repos=()
for d in "$ROOT"/*/; do
  r="$(basename "$d")"
  [ -d "$d/.git" ] || continue
  [ -d "$d/.claude/agents" ] || continue
  repos+=("$r")
done

[ ${#repos[@]} -eq 0 ] && { echo "INCONCLUSIVE: no kit-bearing repos found under $ROOT"; exit 2; }

fail=0; incon=0

echo "=============================================================="
echo " CHECK 1 — agent section references resolve in CLAUDE.md"
echo "=============================================================="
for r in "${repos[@]}"; do
  cm=""
  [ -f "$ROOT/$r/.claude/CLAUDE.md" ] && cm="$ROOT/$r/.claude/CLAUDE.md"
  [ -z "$cm" ] && [ -f "$ROOT/$r/CLAUDE.md" ] && cm="$ROOT/$r/CLAUDE.md"
  if [ -z "$cm" ]; then
    printf "  %-18s INCONCLUSIVE  (agents present, no CLAUDE.md to check against)\n" "$r"; incon=$((incon+1)); continue
  fi
  refs="$(grep -oh '§[0-9]\+' "$ROOT/$r"/.claude/agents/*.md 2>/dev/null | tr -d '§' | sort -un)"
  if [ -z "$refs" ]; then
    printf "  %-18s PASS          (no section references)\n" "$r"; continue
  fi
  missing=""
  for n in $refs; do
    grep -qE "^#+ +$n\." "$cm" || missing="$missing §$n"
  done
  if [ -n "$missing" ]; then
    printf "  %-18s FAIL          cited but absent:%s\n" "$r" "$missing"
    for n in $(echo "$missing" | tr -d '§'); do
      who="$(grep -l "§$n" "$ROOT/$r"/.claude/agents/*.md 2>/dev/null | xargs -n1 basename 2>/dev/null | tr '\n' ' ')"
      printf "  %-18s               └─ §%s cited by: %s\n" "" "$n" "$who"
    done
    fail=$((fail+1))
  else
    printf "  %-18s PASS          (%s resolved)\n" "$r" "$(echo $refs | wc -w)"
  fi
done

echo
echo "=============================================================="
echo " CHECK 2 — kit drift vs fleet mode (CR-normalized content)"
echo "=============================================================="
for sub in hooks agents; do
  files=$KIT_FILES_HOOKS; [ "$sub" = agents ] && files=$KIT_FILES_AGENTS
  for f in $files; do
    declare -A seen=(); order=""
    for r in "${repos[@]}"; do
      p="$ROOT/$r/.claude/$sub/$f"
      h="ABSENT"; [ -f "$p" ] && h="$(hash_norm "$p")"
      seen[$r]="$h"
      case " $order " in *" $h "*) ;; *) order="$order $h";; esac
    done
    # mode = hash held by the most repos
    best=""; bestn=0
    for h in $order; do
      n=0; for r in "${repos[@]}"; do [ "${seen[$r]}" = "$h" ] && n=$((n+1)); done
      [ $n -gt $bestn ] && { bestn=$n; best="$h"; }
    done
    variants=$(echo $order | wc -w)
    [ "$variants" -eq 1 ] && continue   # uniform, say nothing
    printf "  %-18s %d variants (mode %s in %d/%d repos)\n" "$f" "$variants" "$best" "$bestn" "${#repos[@]}"
    for h in $order; do
      [ "$h" = "$best" ] && continue
      out=""; for r in "${repos[@]}"; do [ "${seen[$r]}" = "$h" ] && out="$out $r"; done
      printf "  %-18s   %-8s :%s\n" "" "$h" "$out"
    done
  done
done

echo
echo "=============================================================="
printf " RESULT: %d FAIL, %d INCONCLUSIVE, %d repos checked\n" "$fail" "$incon" "${#repos[@]}"
echo "=============================================================="
[ $fail -gt 0 ] && exit 1
[ $incon -gt 0 ] && exit 2
exit 0
