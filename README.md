# brain-kit

**A file-based memory discipline for coding agents — and the hooks that stop it rotting.**

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen.svg)](package.json)
[![Works with Claude Code](https://img.shields.io/badge/works%20with-Claude%20Code-8A4FFF.svg)](https://claude.com/claude-code)

One file per repo, `BRAIN.md`. The agent reads it in full before doing anything, and writes to it
before the session ends. Investigate once, write it down, never investigate it again.

That is the whole idea. Everything else here exists to keep it honest.

---

## The problem this solves

If you work with coding agents for any length of time you already know the failure:

- Knowledge scatters across chat sessions and dies with them.
- A chat gets too big, so you write a handover — and the handover is lossy.
- The same investigation gets re-run weeks later, burns tokens, and sometimes returns a
  **different answer** than last time.
- A new session starts cold on a codebase you have worked in for months.

The usual fix is "better prompts" or a bigger context window. Neither works, because the problem is
not recall — it is that **nothing durable was ever written down.**

## The fix

```
1. READ    the brain, in full, before any work
2. WORK
3. WRITE   the brain, before the session ends
```

Step 3 is the one everybody skips, and skipping it is what makes step 1 worthless. A brain updated
*usually* is worse than no brain, because you cannot trust it — so you re-investigate anyway, and
you are back where you started. **Trust requires discipline: read every time, write every time.**

The payoff is that handovers stop existing. The brain *is* the handover, continuously. A new chat
reads `BRAIN.md` and is immediately as informed as the chat that got too big. Start new chats
freely; nothing is lost.

---

## Quickstart

### Option A — just the brain (5 minutes, no tooling)

This is most of the value. Do this first.

```bash
cp templates/BRAIN.template.md  /path/to/yourrepo/BRAIN.md
cat BRAIN_DISCIPLINE.md      >> /path/to/yourrepo/.claude/CLAUDE.md
```

Fill in §1 and §2 once. Let the agent maintain the rest. Done.

> Not using Claude Code? Append `BRAIN_DISCIPLINE.md` to whatever file your agent reads first —
> `AGENTS.md`, `.cursorrules`, a system prompt. The method does not care which agent you use.

### Option B — the full kit (several repos, kept in sync)

```bash
git clone https://github.com/intotheveil/brain-kit.git
cd brain-kit

node kit.mjs init   myrepo     # propose myrepo/.claude/CLAUDE.project.md
node kit.mjs apply  myrepo     # compose myrepo/.claude/CLAUDE.md from both halves
./sync-hooks.sh --dry-run      # show which hooks would land where
./verify-kit.sh                # prove every repo is actually aligned
```

Or without cloning, from the directory your repos live in:

```bash
npx agent-brain-kit init  myrepo
npx agent-brain-kit apply myrepo
```

> **Three names, one tool.** The implementation is **`agent-brain-kit`**. `claude-brain-kit` and
> `@alexadamis/brain-kit` are alias packages — three lines each, depending on the real one — because
> people look for this under "agent", under "claude", and under "brain-kit". There is no forked copy
> to drift out of sync, and each alias says on its own npm page that it is an alias.
>
> The unscoped name `brain-kit` is not available: npm's name-similarity guard refuses it because an
> abandoned `brainkit@0.0.0` already occupies that neighbourhood. Scoped names are exempt from the
> check, which is why the `@alexadamis/` one exists.

By default the kit treats **its own parent directory** as the root your repos are siblings in.
Override with `--fleet-root DIR` (`kit.mjs`) or a first argument (the shell scripts):

```
projects/
├── brain-kit/      ← this repo
├── myrepo/
└── otherrepo/
```

---

## What's in the box

| file | what it is |
|---|---|
| `templates/BRAIN.template.md` | The eight-section brain. Copy per repo. |
| `BRAIN_DISCIPLINE.md` | The loop, on one page. Paste into your agent's instructions. |
| `CLAUDE.core.md` | A full project constitution — the half shared by every repo. |
| `templates/CLAUDE.project.template.md` | The half each repo owns (stack, commands, quirks). |
| `kit.mjs` | Composes `CLAUDE.md` from the two halves. No deps, Node ≥ 18. |
| `sync-hooks.sh` | Distributes the hooks to every repo, then re-reads what it wrote. |
| `verify-kit.sh` | Proves alignment. Exits `2` for *inconclusive* — never a silent pass. |
| `hooks/` | Claude Code hooks that enforce the discipline (see below). |

---

## The eight sections, and which one actually matters

| § | section | purpose |
|---|---|---|
| 1 | **What this is** | Context a cold session needs to stop being cold. Rarely changes. |
| 2 | **Architecture** | Kills re-investigation. Every "how does X work" answer lands here, once. |
| 3 | **Current state** | The "where was I" answer. Returning after three weeks takes 30 seconds. |
| 4 | **Outstanding** | The triage queue. Severity-tagged, with a status column. |
| 5 | **Gotchas** | 🔥 **The one that matters.** |
| 6 | **Changelog** | Append-only session log. Replaces the handover. |
| 7 | **Decisions** | Dated ADR-lite, so choices are never re-litigated. |
| 8 | **Telemetry ledger** | Optional: production errors closed out by fingerprint. |

**§5 GOTCHAS is the reason to adopt this.** It is where "we tried that, it breaks Y" lives — the
knowledge that normally dies in a two-week-old chat and gets rediscovered the expensive way. A real
entry from the fleet this kit came from:

> **A line-oriented parser that splits on `'\n'` returns EMPTY on a CRLF file — it does not throw.**
> Every anchored regex stops matching, so the parse came back with 0 sections and 0 items: a blank
> screen, not an error. Tolerance belongs in the parser.

That is one debugging session someone never has to repeat. Twenty of those in a file is worth more
than any amount of prompt engineering.

---

## Why `CLAUDE.md` is composed from two halves

Keeping N repos aligned by telling each one "install the build kit" does not converge. It produced
three different `guard.sh` files in the fleet this came from, each holding a lesson the others never
received, and eight repos whose agents cited a section that did not exist in them.

So the instructions are **generated**, from marker-delimited blocks:

```
<!-- KIT:CORE:BEGIN §5 -->     ← owned by the kit, identical everywhere, overwritten on sync
<!-- KIT:PROJECT:BEGIN §2 -->  ← owned by the repo, never touched by sync
```

`kit.mjs` replaces CORE blocks in place and never reads a PROJECT block. A repo that must deviate
declares it with an ADR and keeps its own section; the composed file then *says* it is a declared
override, so a reader can tell a deliberate deviation from a repo that missed a sync.

It also refuses to compose when a PROJECT block reuses a CORE section number, instead of letting
one silently overwrite the other — a generator built to stop drift must not cause it.

---

## The hooks (Claude Code)

Optional, but they are what turns the discipline from a good intention into a gate.

| hook | does |
|---|---|
| `brain-check.sh` | On session end: was `BRAIN.md` actually updated? |
| `subagent-gate.sh` | Runs lint + typecheck + tests, and **declares what it SKIPPED**. |
| `secret-scan.sh` | Blocks private keys, `sk-` tokens and service-role JWTs in a diff. |
| `guard.sh` | Blocks writes to `.env`, lockfile churn, and other footguns. |
| `format.sh` | Formats what the agent writes. **Configure this before enabling it** — see caveats. |
| `notify.sh` | Desktop notification when a run needs you. |
| `client-data-scan.sh` | Opt-in: for repos holding real customer data. |

`subagent-gate.sh` is the interesting one. A gate that reports success while checking less than it
appears to is worse than no gate — so every run prints what it **ran** and what it **skipped**, with
the reason. `BRAIN_KIT_STRICT=1` (or `ZEUS_STRICT=1`) turns any skip into a hard failure, for CI.

---

## Honest caveats

- **The hooks are Claude-Code-specific; the method is not.** `BRAIN.md` and the loop work with any
  agent. The `hooks/` directory assumes Claude Code's hook contract.
- **Hooks are bash.** Fine on macOS, Linux, and Git Bash on Windows.
- **`CLAUDE.core.md` is opinionated** — independent QA before a phase is claimed, conventional
  commits, RLS on tenant tables, no self-certification by the agent that wrote the code. Read it
  before adopting it. Deviating is expected; deviating *silently* is the thing it forbids.
- **`CLAUDE.project.template.md` ships a house stack** (React + Vite + Supabase). It is a
  placeholder. Replace it with yours.
- **`format.sh` runs your formatter on every file the agent writes.** If your repo has no formatter
  config, it will apply the formatter's defaults and fight your house style — a 10-line change
  becomes a 500-line diff. Pin a config first, or leave this hook out.
- **Brains grow.** Prune §6 periodically. Past ~1 MB you will also hit real limits — GitHub's
  contents API stops inlining file content above 1 MB, which is its own quiet failure mode.

---

## Provenance

Extracted from the internal kit of a private 13-repo fleet, where it has been in daily use across a
desktop, a laptop and a phone. The lessons embedded in the comments are real incidents, not
hypotheticals — the CRLF parser, the three divergent `guard.sh` files, the gate that passed while
running only the tests. Names of private repos have been removed; the lessons have not.

## Support

This is free and MIT, and it stays that way. If it saved you an afternoon of re-explaining
your own codebase to an agent, you can say thanks at **[ko-fi.com/alexdam](https://ko-fi.com/alexdam)**
or with the **Sponsor** button at the top of the repo — entirely optional, and it buys no
priority, no support and no roadmap influence.

Starring the repo genuinely helps more: it is how other people find this kind of thing.

## Contributing

Issues and PRs welcome. The one thing worth knowing before you open a PR: **a lesson in a
comment is the point, not clutter.** Most of the comments in `kit.mjs` and the hooks describe
a real incident, because a rule without its reason gets removed by the next person who finds
it inconvenient. If you change behaviour, say what went wrong that made you change it.

## License

MIT — see [LICENSE](LICENSE). No warranty. It is a discipline and some shell scripts, not a
guarantee that your agent will behave.
