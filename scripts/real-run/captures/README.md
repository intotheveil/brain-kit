# Real-run captures

The raw material for `docs/assets/real-run.{gif,mp4}`. Nothing in the recording is written by
hand: every output line comes from these files.

Recorded 2026-11-05 on Windows 11 (Git Bash) with the **published** `agent-brain-kit@0.2.0`
from npm and Claude Code (`--model sonnet`), in a throwaway sample repo: a ~40-line Node URL
shortener (`package.json`, `src/store.js`, `src/server.js`, one test file, a one-line README).

| file | command | notes |
|---|---|---|
| `1-setup.txt` | `npx agent-brain-kit setup` | fresh repo, nothing in `.claude/` |
| `2-doctor-before.txt` | `npx agent-brain-kit doctor` | straight after setup: 60/100 |
| `3-claude-session.txt` | `claude -p "fill BRAIN.md §1–§2 from the codebase" --permission-mode acceptEdits --model sonnet` | the session's final summary, verbatim. It ran for 74 s |
| `3-brain-diff.txt` | `git diff --stat; git diff BRAIN.md` | what that session changed |
| `4-doctor-after.txt` | `npx agent-brain-kit doctor` | after the session: 85/100 |

The prompt is the one `setup` prints under "Next". The session was **not** asked to write a
changelog entry, a "left off" pointer or a new date. It did all three because the loop that
`setup` put in `.claude/CLAUDE.md` tells every session to.

Edits to the raw output, all of them: the temp directory path is shown as `~/short-links`, and
`NO_COLOR=1` was set so the files hold plain text (`player.html` re-applies the CLI's colours).
In the recording, the 74 s session is sped up (it says so on screen), and its summary is cut to
two of its own sentences with `…` between them.

Re-render: `node scripts/real-run/render.cjs <frames-dir>` (needs Playwright, Chrome and ffmpeg).
