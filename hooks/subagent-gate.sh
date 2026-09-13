#!/usr/bin/env bash
# SubagentStop gate. Enforces CLAUDE.md non-negotiables for code-producing subagents
# before their work is accepted. Exit 2 forces rework.
#
# House default: npm. Each check runs ONLY if the project defines that script, so the gate
# never blocks a project that hasn't defined one — but it no longer skips in SILENCE.
#
# WHY THE SCOPE LINE EXISTS. Measured across a 13-repo fleet: one repo defined neither
# `lint` nor `typecheck`, so a builder there passed this gate having run TESTS ONLY, and the
# output was indistinguishable from a repo where all three ran. Two more had no `typecheck`;
# another had no `lint`. A gate that reports success while checking less
# than it appears to is the same defect class as a reviewer grading against a §6 that does
# not exist. So: every run now declares what it RAN and what it SKIPPED, and a skip names
# the reason. What was not checked is load-bearing information.
#
# ZEUS_STRICT=1 turns any skipped check into a hard failure — for CI and for a release gate,
# where "we couldn't check" must never read as "it passed".
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=/dev/null
source "$DIR/_json.sh"

INPUT="$(cat)"
AGENT_TYPE="$(printf '%s' "$INPUT" | jget '.agent_type')"
cd "${CLAUDE_PROJECT_DIR:-.}"

RAN=""; SKIPPED=""
note_ran()     { RAN="$RAN $1"; }
note_skipped() { SKIPPED="$SKIPPED $1($2)"; }

scope_line() {
  echo "SUBAGENT GATE ($AGENT_TYPE) scope: ran[${RAN:- none}] skipped[${SKIPPED:- none}]" >&2
}
fail() { scope_line; echo "SUBAGENT GATE FAILED ($AGENT_TYPE): $1" >&2; exit 2; }

has_script() { grep -q "\"$1\"[[:space:]]*:" package.json 2>/dev/null; }

# 1) No secrets in the staged diff.
if command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1; then
  if git diff --cached -U0 2>/dev/null | grep -Eiq '(sk-[a-zA-Z0-9]{20,})|(-----BEGIN [A-Z ]*PRIVATE KEY-----)|service_role.*eyJ[A-Za-z0-9_-]{20,}'; then
    fail "a secret appears in the staged diff. Remove it before this work is accepted."
  fi
  note_ran "secret-scan"
else
  note_skipped "secret-scan" "no git"
fi

# Strict check lives in a function because there is more than one exit path, and the first
# version of this file put it only on the LAST one — so a repo with no package.json reported
# three skipped checks and still exited 0 under ZEUS_STRICT=1. A strict mode that is silently
# bypassed by the very case it exists to catch is worse than none.
finish() {
  scope_line
  if [ -n "${ZEUS_STRICT:-}" ] && [ -n "$SKIPPED" ]; then
    echo "SUBAGENT GATE FAILED ($AGENT_TYPE): ZEUS_STRICT=1 and these checks could not run:${SKIPPED}." >&2
    echo "Define the missing npm script(s) in this repo, or clear ZEUS_STRICT for local work." >&2
    exit 2
  fi
  exit 0
}

if [ ! -f package.json ]; then
  note_skipped "typecheck" "no package.json"
  note_skipped "lint" "no package.json"
  note_skipped "test" "no package.json"
  finish
fi

# 2) Typecheck clean (if defined).
if has_script typecheck; then
  npm run typecheck --silent || fail "typecheck failed. Fix types before completing."
  note_ran "typecheck"
else
  note_skipped "typecheck" "no script"
fi

# 3) Lint clean (if defined).
if has_script lint; then
  npm run lint --silent || fail "lint failed. Fix before completing."
  note_ran "lint"
else
  note_skipped "lint" "no script"
fi

# 4) Tests pass (if defined). Core non-negotiable when present.
if has_script test; then
  npm test --silent || fail "test suite is red. Fix the code (do NOT weaken tests) before completing."
  note_ran "test"
else
  note_skipped "test" "no script"
fi

finish
