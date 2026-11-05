# 🧠 BRAIN — brain-kit

> The single source of truth for this repo. Read BEFORE any work, written AFTER any work. If
> something here is wrong, fix it HERE — do not carry the correct version around in a chat.
>
> **The rule that makes this work:** investigate once, write it here, never re-investigate.
>
> Yes, this repo keeps the discipline it ships. A kit that told you to keep a brain while keeping
> none would be worth exactly what it cost you.

**Last updated:** 2026-11-05 by Claude Code (Opus 5.5, Windows desktop) — **launch kit: in-browser doctor on the site (shared `lib/diagnose.mjs`), a REAL-run recording (60 → 85 from one real Claude session), og/social preview cards, 19 Hall of Gotchas cards. v0.2.0 GitHub release published (tag at the npm gitHead).** Before that, same day: **0.2.0 built: the crew ships, `setup` + `doctor`, drift ported, receipts + Hall of Gotchas, animated README, GitHub Pages site in `docs/`. `agent-brain-kit` + `claude-brain-kit` 0.2.0 LIVE on npm, all three packages (verify-published 59/0, CI green).** Previously 2026-10-17 — core ported, README example, v0.1.0 release, r/ClaudeAI post made by the operator. Previously 2026-09-13 — **published.** Public on
GitHub (MIT) and live on npm as three packages, verified from the registry by a 39-check harness.
**Zero stars, zero users, hours old** — which is the honest state and also what blocks the curated
lists (§4 L1).

**Status:** live (public OSS tool) · **Repo:** `github.com/intotheveil/brain-kit`
**npm:** `agent-brain-kit` (implementation) · `claude-brain-kit` · `@alexadamis/brain-kit` (aliases)

---

## 1. WHAT THIS IS

A file-based memory discipline for coding agents, extracted from a private fleet (53 repos as of
2026-11-05) and generalized. One `BRAIN.md` per repo, read in full before work and written before
the session ends.

Shipped alongside it: a seven-agent crew where no agent certifies its own work (since 0.2.0), a
one-command `setup` and a `doctor` health score, a generator that composes a repo's `CLAUDE.md`
from a shared CORE half and a repo-owned PROJECT half, a hook set that enforces the loop, and a
filled-in example brain.

**Done, for this repo:** published, installable, and the README's claims independently checkable by
a stranger in one command.

---

## 2. ARCHITECTURE

- **No app stack.** POSIX shell + one Node ESM script. Node ≥ 18 is the only runtime dependency.
  There is no framework, no database, no build step, and no test runner — `test/verify-published.sh`
  is a shell harness, deliberately.
- **Layout:** `kit.mjs` (CLI entry: setup/doctor/init/compose/apply/check) · `lib/` (`blocks.mjs`
  CRLF-safe block parsing, `setup.mjs`, `doctor.mjs`, `term.mjs` colour only on a TTY without
  `NO_COLOR`) · `CLAUDE.core.md` (the shared constitution half) · `agents/` (the 7 crew agents) ·
  `templates/` (BRAIN, project half, `settings.template.json`) · `examples/` (a filled brain) ·
  `hooks/` (8) · `sync-hooks.sh`, `sync-agents.sh`, `verify-kit.sh` · `packages/` (the two alias
  packages) · `test/` · `docs/` (NOT shipped to npm: GitHub Pages site `index.html`, `assets/`
  animated SVGs, `receipts.md`, `hall-of-gotchas.md`) · `scripts/gen-demo-svg.py` (generates
  `docs/assets/demo.svg`; edit the script, not the SVG).
- **`doctor` is two halves.** `lib/diagnose.mjs` is PURE (no imports at all): `diagnoseFiles({brain,
  loopFiles:[{name,text}], agents}, {dir, today})` grades contents. `lib/doctor.mjs` reads the disk,
  calls it, and renders. The website's doctor (`docs/index.html` `#doctor`) imports
  `docs/assets/diagnose.js`, a BYTE-IDENTICAL copy (Pages serves only `docs/`). `test-kit.mjs`
  fails if the copies differ or if diagnose.mjs grows an import, and asserts that the string path
  and the CLI give the same checks. After ANY edit to `lib/diagnose.mjs`:
  `cp lib/diagnose.mjs docs/assets/diagnose.js`. Repo mode fetches each file from
  `raw.githubusercontent.com/<slug>/HEAD/<file>`, plus 2 GitHub API calls (repo exists? `.claude/agents` listing; 60/h unauth);
  `#doctor=owner/repo` auto-runs, so results are shareable links.
- **Media is generated, never hand-edited.** `scripts/render-demo-gif.cjs` → `demo.gif`;
  `scripts/real-run/render.cjs` → `real-run.{gif,mp4}` + poster from `scripts/real-run/captures/`
  (raw output of a real run; provenance in its README) via `player.html` (a frame = pure function
  of time); `scripts/cards/render.cjs` → `docs/assets/og.png` (1200×630, the page's og:image),
  `docs/assets/social-preview.png` (1280×640, for GitHub Settings, manual upload) and
  `docs/cards/NN-*.png` (19, parsed from `hall-of-gotchas.md`; exits 1 if any card overflows).
  All need Playwright + Chrome (+ ffmpeg for video); run with `NODE_PATH` pointing at a
  node_modules that has playwright, since this repo has no dependencies.
- **`setup [dir]`** installs BRAIN.md, `.claude/CLAUDE.md` (loop only; `--full` composes the
  constitution), `.claude/agents/`, `.claude/hooks/` + `settings.json`. Never overwrites; merges an
  existing settings.json by hook script name (backup `settings.json.pre-brain-kit` once); honours
  `.claude/.no-crew-hooks`; refuses an empty dir arg. **`doctor [dir]`** scores out of 100 (exists 10,
  sections 15, §1-§2 filled 10, last updated 10, gotchas 15, changelog 10, left-off 5, §4 table 5,
  loop in CLAUDE.md/AGENTS.md 15, size 5; crew informational), `--json`, exit 0 at >= 70.
- **The receipts numbers** (`docs/receipts.md`, landing page, README) were counted read-only from
  the private fleet on 2026-11-05 by a script kept OUTSIDE this repo. Refresh them by re-counting,
  never by editing one place: they appear in three files.
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

- **🟢 0.2.0 on npm, all three packages:** `agent-brain-kit` 05:43 UTC, `claude-brain-kit`, and
  `@alexadamis/brain-kit` 05:45 UTC (depends on `^0.2.0`), all 2026-11-05. `verify-published.sh`
  59/0; CI both jobs green.
- **🟢 Landing page LIVE** at https://intotheveil.github.io/brain-kit/ (Pages, legacy build from
  `main` /docs, enabled by the operator 2026-11-05). Checked live: 200, no console errors, no
  horizontal scroll at 1280 and 390, both SVGs load. Every push to main redeploys it.
- **🟢 Launch kit done:** in-browser doctor (`#doctor`), real-run video section, og:image + Twitter
  card meta, 19 gotcha cards in `docs/cards/`. `test-kit.mjs` 31/0. v0.2.0 GitHub release live
  (github.com/intotheveil/brain-kit/releases/tag/v0.2.0, run by the operator).
- **🟢 GitHub social preview set** (operator, 2026-11-05): GraphQL `usesCustomOpenGraphImage: true`,
  serving our 1280×640 `social-preview.png`.
- **⚪️ Few stars, few users.** It is what L1/L3 are for.
- **Next:** the launch posts (L9). Drafts, demo GIF/MP4 and the real-run GIF are with the operator.

---

## 4. OUTSTANDING

| id  | sev | type | summary | status | added |
| --- | --- | ---- | ------- | ------ | ----- |
| L1  | 🟡 | task | **DEFERRED by the operator 2026-09-13 — another time.** Submit to `hesreallyhim/awesome-claude-code` (54k ★). Their rule: 14 DAYS OLD with continued commits, OR 100+ stars — this repo fails both today and a failing submission is **auto-closed**, so the earliest it can even be attempted is ≈ 2026-09-27. Must go via their web issue form (not a PR, not the API) or you risk an interaction restriction. Prepared entry text is in the private fleet notes. **Their own CONTRIBUTING says why this ordering is right: get users, then submit — not the reverse.** | open | 2026-09-13 |
| L2  | 🟡 | task | ~~Post to r/ClaudeAI~~ — **CLOSED 2026-10-17: the operator posted it** from a new account (plain-words draft, no fleet mentions). Watch for replies and stars (L3). A second post in r/ClaudeCode is possible a few days later with changed text. | closed | 2026-09-13 |
| L3  | 🟡 | task | **Get the first stars.** A submission landing on a 0-star repo converts badly — people check. Blocks L1 and weakens L2. | open | 2026-09-13 |
| L4  | 🟠 | gap | ~~This repo and the private kit it came from will drift, and nothing prevents it~~ — **CLOSED 2026-09-13.** The upstream fleet added `compare-public.sh`, which records a FORK POINT for the 15 shared file pairs and reports which SIDE has moved since. Deliberately not a copier and not an equality check: most shared files legitimately differ (private names stripped, root resolved from this checkout, `templates/` layout), so copying would regress that and demanding equality would be permanently red and ignored. Proven on first real use — it caught a `kit.mjs` fix made upstream and not yet ported, which was then ported here (the flag-as-command fix + `test/test-kit.mjs`). **This repo is the downstream side: changes made HERE still need carrying back, and that is the direction with no one watching it.** | closed | 2026-09-13 |
| L5  | 🟡 | bug | ~~`claude-brain-kit@0.1.0` is permanently broken on npm~~ — **CLOSED 2026-09-13 as MITIGATED, not fixed.** It published depending on `brain-kit@^0.1.0`, a package the name-similarity guard then made impossible. npm does not allow unpublishing after 72h, so **the bad version stays on the registry forever** and anyone pinning that exact version gets a failure. What was done is all that can be: it is `npm deprecate`d with a pointer, and `latest` is 0.1.2, which resolves correctly. Closed because no action remains — not because the wart is gone. | closed | 2026-09-13 |
| L6  | 🔵 | idea | ~~No CI~~ — **CLOSED 2026-09-13.** `.github/workflows/verify.yml`, two jobs with different jobs to do: **`repo`** on every push/PR (every shell script parses, the 9 `kit.mjs` unit tests, manifests are valid JSON, no private fleet reference leaked) and **`published`** on a weekly schedule, which downloads all three packages from npm into a throwaway dir and ignores the working tree entirely. The scheduled half is the point — the repo can be healthy while the ARTIFACT is broken, which already happened here when `claude-brain-kit@0.1.0` shipped depending on a package that could never exist. Every step dry-run locally first, which is how the leak-scan was caught matching its own pattern. | closed | 2026-09-13 |
| L9  | 🟡 | task | **Launch posts** for 0.2.0 (r/ClaudeCode, r/ClaudeAI follow-up, X), lead with the 57 QA failures and the Hall of Gotchas. Operator posts; nothing is posted by an agent. | open | 2026-11-05 |
| L10 | 🔵 | idea | `setup` could add a `.gitattributes` line forcing LF on `.claude/hooks/*.sh` (CRLF breaks bash hooks on Windows checkouts with autocrlf). Also carry back upstream: verify-kit's "BRAIN.md §N is not a CLAUDE.md citation" filter and the generalized §10 wording. **Seen for real 2026-11-05:** committing a `setup`-installed repo on this machine (`core.autocrlf=true`) warned "LF will be replaced by CRLF" for every `.claude/hooks/*.sh`. | open | 2026-11-05 |

---

## 5. GOTCHAS

- **🔴 THIS BRAIN IS PUBLIC — A FLEET-WIDE NOTE MUST NOT BE PASTED INTO IT.** On 2026-10-13 a
  machine-hardware note naming private game projects was added here by a fleet-wide brain update;
  it sat in a public repo until 2026-11-05. Anything broadcast to "every brain" must skip this one.
  The CI leak scan only matches a fixed pattern, so it could not catch names it did not know.

- **🔴 A HEREDOC-FED SCRIPT CAN TURN `\n` INTO A REAL NEWLINE.** On 2026-11-05 a Python one-off fed
  through a Bash heredoc wrote a literal line break where the source said `'\n'` (and a `\1` in the
  harness became a control byte, which then "passed" on garbage). For any text that contains
  escapes, write the file with an editor tool, then grep the bytes (`od -c`) before trusting it.

- **🔴 A `.mjs` MODULE CAN BE REFUSED BY THE BROWSER: SOME SERVERS SEND IT AS `text/plain`.**
  Python's `http.server` on Windows did, and a module script with the wrong MIME type fails to
  load with only a console error, so the in-browser doctor silently did nothing. The site's copy
  is `diagnose.js` for that reason. Same bytes, and every server labels `.js` correctly.

- **🔴 CENTRED FLEX CONTENT OVERFLOWS UPWARD, WHERE `scrollHeight` CANNOT SEE IT.** The card
  fitter checked `scrollHeight > clientHeight`, reported all 19 cards as fitting, and every card
  had text running into its header. With `justify-content:center` the overflow goes out of the
  top, which is outside the scrollable area. Measure the children's heights instead, and LOOK at
  one output before trusting a fitter's "fits".

- **🔴 `npm view` CAN SHOW A STALE VERSION LIST MINUTES AFTER A PUBLISH**, even with
  `--prefer-online`: the scoped alias read 0.1.1 while 0.2.0 had been live for minutes, and the
  operator was sent to re-publish (`cannot publish over 0.2.0`). Check `npm view <pkg> time --json`
  or install it before saying a publish is missing.

- **🔴 SCREENSHOTTING AN ANIMATED SVG HANGS OR SHOWS AN EMPTY FRAME.** Playwright's full-page
  screenshot timed out on the infinite CSS animations, and `animations: 'disabled'` resets infinite
  ones to frame 0 (every demo line invisible). Render with `reducedMotion: 'reduce'`: both SVGs show
  their full final state under `prefers-reduced-motion`, which is also what a reduced-motion reader
  sees.

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

### 2026-11-05 — launch kit: browser doctor, a real run, share cards, release
- Did: split `doctor` into a pure `lib/diagnose.mjs` + fs/render `lib/doctor.mjs` (behaviour
  unchanged: the 28 earlier tests stayed green, and the CLI scores this repo the same as before).
  Built the in-browser doctor (repo / paste / shareable `#doctor=` link) on a byte-identical copy,
  plus 3 tests (identical copy, no imports, strings == CLI). The drift test was proven to fail by
  appending one line to the copy.
- Did: a REAL run in a throwaway sample repo with the published 0.2.0. `setup` created 17 files,
  doctor gave 60, then `claude -p "fill BRAIN.md §1–§2 from the codebase"` (sonnet, 74 s) ran, and
  doctor gave 85. Unprompted, the session also wrote a changelog entry with "Left off" and bumped
  the date, because the loop told it to. That is the strongest proof the kit has, and it is now
  the site's and README's "real run" section. Captures + provenance are in `scripts/real-run/captures/`.
- Did: og:image + Twitter card meta; `og.png`, `social-preview.png`, 19 gotcha cards; README
  real-run GIF and browser-doctor link; Hall links the cards. The v0.2.0 release (tag at d4b1dfd,
  the commit npm records as `gitHead`) and the description/topics were refused to the agent as a
  public surface; the commands are in L12.
- Resolved: `doctor` on this repo gave 95: the 2 previous changelog entries had no "Left off" line.
  It was right. This entry has one.
- Left off: release + description/topics DONE by the operator (L12 closed). Social preview uploaded (L11 closed). Only L9 remains: the launch posts. Nothing else is
  owed by an agent. Next agent work, if any: L10 `.gitattributes` for hooks.

### 2026-11-05 — 0.2.0 published (2 of 3), demo GIF in the README
- Operator published `agent-brain-kit` 0.2.0 and `claude-brain-kit` 0.2.0. `verify-published.sh`
  59/0; re-ran CI run 41975157730, both jobs green. The scoped alias was in fact live at 05:45; Pages still 404 (L8).
- L7 closed: all three packages at 0.2.0.
- L8 closed: Pages live; added an inline data-URI favicon (the missing `/favicon.ico` was the
  only console error on the live page).
- `! npm login` from the agent prompt fails: it times out waiting on the web login, falls back to a
  `Username:` prompt on a null stdin, and exits 1. npm login has to happen in a real terminal.
- `docs/assets/demo.gif` (dark, 900×372, 10 fps, 18 s loop, 118 KB) rendered from `demo.svg` by
  `scripts/render-demo-gif.cjs` + ffmpeg (two-pass palette); for X/launch posts and the README hero.
- README hero now points at the GIF by ABSOLUTE raw.githubusercontent URL: npmjs.com does not
  render the repo-relative SVG, and the 0.2.0 tarball's README is frozen at publish time.
  Re-run the script after any change to `scripts/gen-demo-svg.py`, or the GIF goes stale.
- Frame capture: pause every `document.getAnimations()` and set `currentTime` per frame —
  deterministic (two runs gave byte-identical frames), no real-time waiting.

### 2026-11-05 — 0.2.0: the crew ships, setup + doctor, receipts, a site

- **Operator ask:** make the public kit "memorable and WOW", no mythology branding ("some people are
  weird"). Reverses the 2026-09-13 decision not to publish the crew (§7).
- **Code (5 commits, c5a5579..856783b):** upstream drift ported (CRLF fix into `lib/blocks.mjs`,
  gate per-worktree lock + `.claude/gate.conf`, PowerShell guard rules, binary-safe scans, prettier
  only with a config, sync/verify skip opted-out repos and worktrees, verify-kit CHECK 3); `agents/`
  (7) + `sync-agents.sh` (keep-list in `.claude/.keep-agents`); `setup` and `doctor`; tests 9 -> 28;
  the old fleet-named strict variable renamed `BRAIN_KIT_STRICT`; a private dashboard name in
  `CLAUDE.core.md` §10 generalized;
  version 0.2.0, aliases `^0.2.0`. Upstream manifest machinery (`fleet.repos`, packs, EXCEPTIONS)
  deliberately NOT ported.
- **Docs:** `docs/receipts.md` (53 repos, 118 days, 3,142 brain commits, ~2,600 gotchas, 57 qa
  FAILED, 296 REVISE, method stated per number), `docs/hall-of-gotchas.md` (19 incidents,
  sanitized), animated `docs/assets/loop.svg` + generated `demo.svg`, landing page `docs/index.html`,
  README rewritten around them (fixes the stale strict-variable line).
- **Removed** a private hardware note from §5 that named private projects (§5 first entry).
- **Real runs:** `setup` into a fresh git dir (17 created, second run 17 kept), `doctor` 60/100 on
  the template and exit 1; landing page renders with no console errors and no horizontal scroll at
  390 px and 1280 px, light and dark.
- **Left off:** L7 npm publish (operator login), then `verify-published.sh` green, then L8 Pages
  check, then L9 posts. `compare-public.sh --accept` upstream is the fleet's call after review.

### 2026-10-17 — core ported, README example, v0.1.0 release, Reddit post

- **Ported to `CLAUDE.core.md` only (operator: core changes only):** the `researcher` agent line, generic model tiers (no local-AI paragraph), the one-writer-per-checkout rule and the worktree rule. Left out the sentence about the SubagentStop gate lock because the public `subagent-gate.sh` has no lock yet.
- **Still NOT ported (drift remains, do not run `compare-public.sh --accept`):** `kit.mjs` (CRLF fix), `sync-hooks.sh`, `verify-kit.sh`, hooks `guard.sh`, `format.sh`, `subagent-gate.sh`, `client-data-scan.sh`. npm is still 0.1.0 and does not carry the new core text; bump to 0.1.1 only with a deliberate publish.
- README gained "What a new session looks like" (without/with a brain). Tag and GitHub release `v0.1.0` created on the published commit `f200293`. `docs/` is still an empty folder.
- The operator posted to r/ClaudeAI. Commits: core port `b035f35`, README, tag `v0.1.0`.
- **Left off:** port the 7 remaining files, then 0.1.1; watch the Reddit post.

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
- ~~**2026-09-13:** the crew agents are NOT published here.~~ **SUPERSEDED 2026-11-05 by the
  operator:** the crew ships (`agents/`, installed by `setup`, `--no-crew` to skip), and the README
  now documents the workflow, which was the reason given for holding it back. Plain role names, no
  branding.
- **2026-11-05:** `setup` installs the brain LOOP into `.claude/CLAUDE.md`, not the full
  constitution, unless `--full`. A stranger's repo should not receive pages of rules about tenant
  tables and phase gates it never asked for (the same reasoning as the first decision above).
- **2026-11-05:** the website lives in `docs/` on `main` (GitHub Pages), self-contained, no build
  step, and is excluded from the npm package. One repo, one source of truth for the numbers.
