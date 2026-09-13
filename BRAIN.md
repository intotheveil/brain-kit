# 🧠 BRAIN — brain-kit

> The single source of truth for this repo. Read BEFORE any work, written AFTER any work. If
> something here is wrong, fix it HERE — do not carry the correct version around in a chat.
>
> **The rule that makes this work:** investigate once, write it here, never re-investigate.
>
> Yes, this repo keeps the discipline it ships. A kit that told you to keep a brain while keeping
> none would be worth exactly what it cost you.

**Last updated:** 2026-09-13 by Claude Code (Opus, Windows desktop) — **published.** Public on
GitHub (MIT) and live on npm as three packages, verified from the registry by a 39-check harness.
**Zero stars, zero users, hours old** — which is the honest state and also what blocks the curated
lists (§4 L1).

**Status:** live (public OSS tool) · **Repo:** `github.com/intotheveil/brain-kit`
**npm:** `agent-brain-kit` (implementation) · `claude-brain-kit` · `@alexadamis/brain-kit` (aliases)

---

## 1. WHAT THIS IS

A file-based memory discipline for coding agents, extracted from a private 13-repo fleet and
generalized. One `BRAIN.md` per repo, read in full before work and written before the session ends.

Shipped alongside it: a generator that composes a repo's `CLAUDE.md` from a shared CORE half and a
repo-owned PROJECT half, a hook set that enforces the loop, and a filled-in example brain.

**Done, for this repo:** published, installable, and the README's claims independently checkable by
a stranger in one command.

---

## 2. ARCHITECTURE

- **No app stack.** POSIX shell + one Node ESM script. Node ≥ 18 is the only runtime dependency.
  There is no framework, no database, no build step, and no test runner — `test/verify-published.sh`
  is a shell harness, deliberately.
- **Layout:** `kit.mjs` (compose/apply/check) · `CLAUDE.core.md` (the shared constitution half) ·
  `templates/` (BRAIN + project-half templates) · `examples/` (a filled brain) · `hooks/` (8) ·
  `sync-hooks.sh`, `verify-kit.sh` · `packages/` (the two alias packages) · `test/`.
- **THREE NPM NAMES, ONE IMPLEMENTATION.** `agent-brain-kit` holds the code. `claude-brain-kit` and
  `@alexadamis/brain-kit` are three-line packages that depend on it and `import
  'agent-brain-kit/kit.mjs'`. **The unscoped name `brain-kit` is UNOBTAINABLE** — see §5.
- **Root resolution:** `--fleet-root` wins; otherwise the parent of the kit checkout, then `cwd`
  (which is what `npx` needs, since the package then sits under `node_modules`). Never one
  hardcoded relative path — that assumption is what made the original unusable outside its
  birthplace.
- **🔴 THIS REPO IS A FORK OF A PRIVATE KIT, AND NOTHING SYNCS THEM.** It was extracted from
  `zeus/.zeus/kit/` in a private fleet. There is no sync in either direction, so a fix here is
  invisible there and vice versa. Two divergences are DELIBERATE and a naive copy would regress
  them: the root resolution above, and templates living under `templates/`. See §4 L4.

---

## 3. CURRENT STATE

- **🟢 Published and verified.** `bash test/verify-published.sh` → **39 checks, 0 failures**,
  against packages downloaded from the registry rather than the working tree.
- **🟢 All three packages resolve to one implementation**, each proven by fresh install + run.
- **⚪️ Zero stars, zero users.** Not a problem to fix by pushing code — it is what L1/L2/L3 are for.
- **Next:** get the first stars, then the r/ClaudeAI post, then the curated list after 2026-09-27.

---

## 4. OUTSTANDING

| id  | sev | type | summary | status | added |
| --- | --- | ---- | ------- | ------ | ----- |
| L1  | 🟡 | task | **DEFERRED by the operator 2026-09-13 — another time.** Submit to `hesreallyhim/awesome-claude-code` (54k ★). Their rule: 14 DAYS OLD with continued commits, OR 100+ stars — this repo fails both today and a failing submission is **auto-closed**, so the earliest it can even be attempted is ≈ 2026-09-27. Must go via their web issue form (not a PR, not the API) or you risk an interaction restriction. Prepared entry text is in the private fleet notes. **Their own CONTRIBUTING says why this ordering is right: get users, then submit — not the reverse.** | open | 2026-09-13 |
| L2  | 🟡 | task | **Post to r/ClaudeAI.** Draft written (problem-first: opens on re-explaining your codebase every session, leads with the CRLF gotcha, mentions the tool last). Check the subreddit's current self-promotion rules before posting. | open | 2026-09-13 |
| L3  | 🟡 | task | **Get the first stars.** A submission landing on a 0-star repo converts badly — people check. Blocks L1 and weakens L2. | open | 2026-09-13 |
| L4  | 🟠 | gap | ~~This repo and the private kit it came from will drift, and nothing prevents it~~ — **CLOSED 2026-09-13.** The upstream fleet added `compare-public.sh`, which records a FORK POINT for the 15 shared file pairs and reports which SIDE has moved since. Deliberately not a copier and not an equality check: most shared files legitimately differ (private names stripped, root resolved from this checkout, `templates/` layout), so copying would regress that and demanding equality would be permanently red and ignored. Proven on first real use — it caught a `kit.mjs` fix made upstream and not yet ported, which was then ported here (the flag-as-command fix + `test/test-kit.mjs`). **This repo is the downstream side: changes made HERE still need carrying back, and that is the direction with no one watching it.** | closed | 2026-09-13 |
| L5  | 🟡 | bug | ~~`claude-brain-kit@0.1.0` is permanently broken on npm~~ — **CLOSED 2026-09-13 as MITIGATED, not fixed.** It published depending on `brain-kit@^0.1.0`, a package the name-similarity guard then made impossible. npm does not allow unpublishing after 72h, so **the bad version stays on the registry forever** and anyone pinning that exact version gets a failure. What was done is all that can be: it is `npm deprecate`d with a pointer, and `latest` is 0.1.2, which resolves correctly. Closed because no action remains — not because the wart is gone. | closed | 2026-09-13 |
| L6  | 🔵 | idea | ~~No CI~~ — **CLOSED 2026-09-13.** `.github/workflows/verify.yml`, two jobs with different jobs to do: **`repo`** on every push/PR (every shell script parses, the 9 `kit.mjs` unit tests, manifests are valid JSON, no private fleet reference leaked) and **`published`** on a weekly schedule, which downloads all three packages from npm into a throwaway dir and ignores the working tree entirely. The scheduled half is the point — the repo can be healthy while the ARTIFACT is broken, which already happened here when `claude-brain-kit@0.1.0` shipped depending on a package that could never exist. Every step dry-run locally first, which is how the leak-scan was caught matching its own pattern. | closed | 2026-09-13 |

---

## 5. GOTCHAS

- **🔴 `npm view <name>` RETURNING 404 MEANS UNREGISTERED, NOT PUBLISHABLE.** `brain-kit` was
  404 on every read and still refused at publish: *"Package name too similar to existing package
  **brainkit**"*. The blocker is an abandoned `brainkit@0.0.0` whose description is the literal
  string "To install dependencies:". **The similarity guard runs ONLY at publish time**, so the
  first honest signal is a 403 after you have already told everyone the name is free. Scoped names
  (`@user/thing`) are exempt from the check — that exemption is the entire reason
  `@alexadamis/brain-kit` exists.

- **🔴 A FAILED `npm publish` CAN STILL RESERVE THE VERSION.** A publish whose browser-2FA
  handoff does not complete leaves the version **STAGED**: `npm publish` then refuses with
  *"Cannot publish over previously staged version"* while the packument 404s and `npm view` shows
  the version does not exist. Both statements are true at once. Bumping the version is the cheap
  way out; the reservation expires on its own schedule.

- **🔴 THE REGISTRY'S READ APIs LAG BEHIND ITS WRITES, SO "IT DID NOT PUBLISH" CAN BE WRONG.**
  Twice in one session a publish was reported as missing by a direct packument read, and appeared
  minutes later. **`npm access list packages` — the OWNER-side view — told the truth first**, listing
  a package every other read called 404. When a publish and a read disagree, neither is authority:
  check the owner view, then wait.

- **🔴 A LITERAL `|` INSIDE A MARKDOWN TABLE CELL BREAKS THE ROW — EVEN INSIDE BACKTICKS.** An
  outstanding-item summary that quoted a table shape parsed with `status: "id"`, silently shifting
  every column. Caught only because the check printed per-row statuses instead of a row COUNT —
  counting said "7 rows" and looked fine.

- **🔴 `mktemp -d` GIVES A POSIX PATH THAT WINDOWS `node` CANNOT RESOLVE.** `node -p
  "require('<abs path>/package.json')"` fails under Git Bash because the Windows binary does not
  understand `/tmp/…`. The first portable run of this repo's own test harness failed on exactly
  this. Parse such files in shell, or keep paths Windows-resolvable. **The harness finding a real
  bug on its first run is the only reason to believe it when it passes.**

- **A `files` ARRAY IS A PROMISE YOU SHOULD VERIFY.** `npm pack --dry-run` lists what actually
  ships. A template or hook silently excluded turns `init` into a confusing failure for a stranger
  and works perfectly for you, because your copy has the file on disk.

- **AN ALIAS PACKAGE MUST BE PUBLISHED AFTER THE THING IT ALIASES.** `claude-brain-kit` published
  first, depending on a package that then could not be created — shipping a live, uninstallable
  version that cannot be withdrawn (L5).

---

## 6. CHANGELOG

### 2026-09-13 — extracted, generalized, published, verified

- **Extracted** from a private fleet's internal kit. Every private repo name removed from code AND
  comments — **the lessons those comments carry were kept**, because a rule without its reason gets
  deleted by the next person who finds it inconvenient.
- **Generalized properly, not just copied:** telemetry section made tracker-agnostic; templates
  moved under `templates/` and `kit.mjs` rewired; and the root resolution fixed. The original
  assumed it sat three levels down inside another repo — one hardcoded relative path, the same bug
  class that had made a sibling project's e2e suite unrunnable on its own primary machine that
  morning.
- **Published** to GitHub (MIT, 12 topics) and npm. `brain-kit` proved unobtainable (§5), so
  `agent-brain-kit` is the implementation and the other two are aliases.
- **`test/verify-published.sh` added** — 39 checks against the REGISTRY, two of them adversarial
  (`apply` must REFUSE a half-filled project half; `check` must CATCH an edited CORE block). A
  suite that only confirms the happy path cannot tell you it is working.
- **An example brain shipped.** A template full of placeholders persuades nobody; a §5 that has
  obviously been carrying weight does.

**Left off:** nothing technical. The open items are all distribution (L1–L3) plus the fork
divergence (L4). **Do not "fix" the lack of stars by writing more code.**

---

## 7. DECISIONS

- **2026-09-13:** this repo does **NOT** compose the full fleet constitution, deliberately. The
  shared CORE half assumes tenant tables, migrations and a phased delivery arc — none of which
  exist here. Installing it would give every agent pages of inapplicable rules to grade against,
  which is the same defect, inverted, that the kit exists to prevent: *a reviewer citing a section
  that does not apply improvises rather than failing*. This repo keeps §0 (the brain loop, the part
  that does apply) and states its own commands honestly. A project is a project; the format serves
  it, not the reverse.
- **2026-09-13:** three npm names, one implementation, aliases declared as aliases on their own npm
  pages. Discoverability without three forks to keep in step.
- **2026-09-13:** the crew agents are NOT published here. They are fleet tooling, not part of what
  this kit promises, and publishing them would invite issues about a workflow this repo does not
  document.
