# 🧠 BRAIN — Beacon

> **This is an EXAMPLE**, adapted from a brain that has been in daily use for months. The product
> is fictional and the names are changed; **the gotchas are real incidents**, because inventing
> plausible-sounding ones would defeat the purpose of showing you what §5 is for.
>
> Read §5 first. It is the section that justifies the whole method — everything else is
> bookkeeping you could have guessed at.

**Last updated:** 2026-09-13 (the store client could not be constructed at all) by Claude Code
(Opus, Windows desktop) — **🔴 `createClient` THREW in the Electron main process**, so every
secret-store IPC was broken, not just the one we noticed. Electron bundles Node 20 and has no
global `WebSocket`. Two sibling files already carried the fix; this one never got it.
Previously — the launcher now passes the project's env to the session it opens; measured, not
assumed, because nobody knew whether the terminal host preserved a spawn's environment.

**Status:** live (internal tool, one team)
**Repo:** `~/projects/beacon` · `github.com/acme/beacon` (private)
**Deployed:** not a web app — a packaged desktop app, a sideloaded APK, and a daemon

---

## 1. WHAT THIS IS

Beacon is the deploy console for our services. Three surfaces, one codebase:

- **Desktop (Electron)** — service list, live error feed, one-click session launch.
- **Mobile (Capacitor)** — a glance view and remote deploy trigger.
- **`apps/beacon-cli`** — hydrates a machine's env from the encrypted store.

"Done" for a feature: merged to `main`, gates green (lint + typecheck + full suite), **pushed**,
and device-verified where a device is the only place it can be proven.

---

## 2. ARCHITECTURE

- **Stack:** Electron 33 + React 18 + Vite + TypeScript 5.7 + Tailwind · Capacitor 6 (JDK 17) ·
  plain Node/TS under `tsx` for the CLI · Postgres with RLS on every tenant table · Vitest +
  Playwright.
- **Workspaces:** `packages/read-layer` (pure, portable), `packages/store` (crypto + data layer),
  `apps/{mobile,cli}`.
- **Secret store:** envelope encryption. `scrypt(passphrase, salt, N=2^17)` → KEK; a random 32-byte
  DEK seals every secret; only the wrapped DEK is stored. A passphrase change re-wraps ONE record
  and rewrites no ciphertext. Encryption is client-side — the server only ever holds ciphertext,
  IV and tag. A secret's address is **`(project, env_path, key_name)`**: `env_path` is the
  repo-relative FILE, so `.env` and `.env.local` stay distinct.
- **WHICH LAUNCH PATHS CARRY THE ENV** (investigated 2026-09-12 — do not re-derive):

  | launch path | env injected? |
  | --- | --- |
  | Desktop → "Open session" | **YES** since 2026-09-12 — resolves the project, merges, strips `API_KEY` last |
  | Desktop → background dispatch | **NO** — carries approval vars only, deliberately |
  | Phone → remote workstation | **YES** — merges then strips |

  The asymmetry used to run backwards: a phone-launched session arrived with its secrets while one
  launched from the console you had just unlocked did not. That is the root cause behind sessions
  going hunting for tooling that was already there.

---

## 3. CURRENT STATE

- **🟢 Suite green: 125 files / 1,199 tests.** `tsc --build` 0 · `eslint` 0 errors · the
  packaged artifact rebuilds byte-identical.
- **🟢 Session env injection is proven ON HARDWARE** — `Opened · 12 keys · 1 shadowed` on a
  real machine, after the fix below. Proven in code is not proven.
- **⚠️ The e2e suite tests against the REAL user profile on Windows** — see E1. Treat every e2e
  pass here with suspicion until that is fixed.
- **Next:** E1 (e2e isolation), then the format check on well-known secret names.

---

## 4. OUTSTANDING

| id | sev | type | summary | status | added |
|----|-----|------|---------|--------|-------|
| B14 | 🔴 | bug | ~~The main-process store client could not be CONSTRUCTED~~ — **CLOSED 2026-09-13.** `createClient` threw; broke every store IPC, not just the launch. | closed | 2026-09-13 |
| B11 | 🔴 | bug | ~~Remove deleted the WRONG secret~~ — **CLOSED.** The preload call was positional `(project, key)` and structurally could not carry `env_path`. | closed | 2026-09-12 |
| E1 | 🟠 | gap | **The e2e isolation is LINUX-ONLY and fails silently.** Electron ignores `XDG_CONFIG_HOME` on Windows, so specs run against the real profile — and still pass, because that profile is configured. | open | 2026-09-13 |
| E2 | 🟡 | gap | **The health tile never re-probes.** One probe per window, no interval, no refresh in the ready state — so it is pinned to whatever it saw at startup. | open | 2026-09-13 |
| B13 | 🟡 | gap | `set` cannot tell a wrong-KIND secret from a right one. A format check on well-known names would catch it at storage time. Warn-and-confirm, never refuse. | open | 2026-09-12 |
| B2 | 🟠 | security | The daemon holds the passphrase when the env var is set — an always-on service with the key to everything. Default OFF until per-device keys land. | open | 2026-08-25 |

---

## 5. GOTCHAS

> The section that pays for the method. Every entry below cost somebody hours once, and exactly
> once.

- **🔴 A LINE-ORIENTED PARSER THAT SPLITS ON `'\n'` RETURNS EMPTY ON A CRLF FILE — it does not
  throw.** Every anchored regex stops matching, so the parser came back with 0 sections and 0
  items: a blank screen, not an error. `core.autocrlf=true` is machine-wide on Windows, so a file
  committed from any Windows box would have blanked the view for everyone. **Tolerance belongs in
  the parser** — the alternative is trusting that no Windows machine ever writes one.

- **🔴 IN JAVASCRIPT `.` DOES NOT MATCH `\r`.** Any line-anchored regex like `/--.*$/`
  therefore STOPS WORKING on a CRLF file: `.*` halts before the `\r`, `$` can no longer match, and
  the replace becomes a silent no-op. Split on `/\r?\n/` before any such regex.

- **🔴 A DEFAULT IS THE ENEMY OF A LOUD FAILURE.** `envPathOf` defaulted a missing path to
  `.env` instead of throwing. That one default claimed **five** consumers: two wrong-row READS,
  and — for months, unnoticed — a wrong-row **DELETE**. Nothing ever threw; the query simply
  resolved to a different row. Treat every address built without its full key as a live defect.

- **🔴 A FIXTURE WHERE EVERY PROJECT OWNS ONE FILE CANNOT CATCH A MISSING FILE FIELD.** Under a
  mutation that dropped `env_path` from the delete call, **all 15 pre-existing tests stayed
  green.** The hole was the FIXTURE, not the assertions — which is why 1,100 tests, a QA pass and
  a review all missed silent data destruction. **When a field distinguishes two rows, the fixture
  must contain two rows that differ ONLY in that field.**

- **🔴 A GREEN SUITE CANNOT TELL YOU THE BINARY RUNS.** The test runner aliases package
  specifiers to source, so it sees neither package-boundary resolution nor module-system
  differences; `tsc` and lint see neither either. Two real crashes shipped past all three. Run the
  actual binary before claiming anything works.

- **🔴 THE TEST RUNNER AND THE ARTIFACT CAN BE DIFFERENT RUNTIMES.** Vitest runs under the
  host's Node (v24, which HAS a global `WebSocket`); the Electron main process runs Node 20, which
  does not. The database client constructs a realtime socket EAGERLY, so it threw at construction
  in the app and never in a test. 1,199 green tests sat on top of a feature that could not start.
  The suite was not weak — it was executing somewhere else.

- **🔴 "DEGRADE, NEVER BLOCK" IS ONLY TRUE IF A *THROW* DEGRADES TOO.** The launcher handled
  every failure the store could RETURN and none it could RAISE, so an exception escaped as
  `Error invoking remote method` and opened nothing at all — strictly worse than the case the
  branch existed to serve. **When a comment promises a degradation, the promise covers the
  unexpected case or it is not a promise.**

- **🔴 AN IPC PAYLOAD THAT NOTHING RENDERS IS NOT "REPORTING".** We added a summary field,
  populated it correctly and tested it — and the user still saw a bare `Opened`, because it
  stopped at a `console.log` in a process launched from a shortcut with **no console**. A comment
  in the source claimed the user "is TOLD"; the code contradicted it. A contract field is only
  communication once a surface reads it.

- **🔴 A CLEAN EXIT IS NOT EVIDENCE.** The database CLI **silently skips** any migration not
  matching its filename pattern — it prints `Skipping migration …` and **exits 0**. Four repos
  documented that command in their own instructions, so an agent following them would believe a
  migration applied when nothing ran. Verify the object exists at source, in `pg_trigger` /
  `pg_proc` / `pg_indexes`.

- **🔴 AN INJECTED ENV VAR CAN SHADOW A WORKING CREDENTIAL — injection is not always
  additive.** The CLI was authenticated the whole time, and injecting a stale token from the store
  broke it. Hours went into fixing tooling around a credential that was already present.
  **Before debugging why an injected secret does not work, check whether the tool works WITHOUT
  it.**

- **🔴 A MUTATION THAT FAILS TO APPLY IS INDISTINGUISHABLE FROM A FIX THAT WAS NOT NEEDED.**
  The first red-verify was mangled by shell escaping, never touched the source, and reported
  everything green — which reads exactly like proof the fix is decorative. **Verify the mutation
  landed before believing the result.**

- **`vi.spyOn(console, 'error').mockRestore()` ERASES `mock.calls`.** Asserting over the spy after
  restoring it reads an empty array — a vacuously passing test. Collect lines inside
  `mockImplementation` instead. Caught only because the test was itself mutation-checked.

- **EXTRACTING A SHARED MODULE REMOVES THE TESTS THAT GUARDED IT.** A merge helper absorbed two
  validated implementations correctly — but the proof that it is all-or-nothing was left behind in
  callers that all exercise the same shape. **When logic moves into a shared package, its tests
  move with it**, or consolidation quietly converts N tested copies into one under-tested original.

- **🔴 A COUNT TAKEN BEFORE A DEDUPLICATING STEP CANNOT BE THE EXPECTED VALUE AFTER IT.** The
  documented observable said `12 keys`; the store holds **13 rows**, two of which are the same key
  in different files. A wrong expected value turns a PASSING check into a suspected failure — we
  nearly "fixed" working code because of it.

- **🔴 A HOOK FILE ON DISK THAT NO CONFIG REFERENCES DOES NOTHING.** Ours sat inert for a day
  after being added. **Check wiring, not presence.**

- **🔴 A FORMATTER WITH NO CONFIG WILL FIGHT YOUR HOUSE STYLE.** The format hook runs
  `prettier --write` on every file an agent touches, and this repo has no prettier config — so it
  applies defaults (double quotes, semicolons) against a single-quote, no-semicolon codebase. 238
  files disagree with it, and a 10-line change becomes a 500-line diff a reviewer will correctly
  reject as scope creep.

- **🔴 "DONE" MEANS PUSHED.** A routine push once carried **12** commits — seven from the
  previous day, including a data-loss fix. For a full day this brain described that work as done
  while it sat on one machine. `git status` says clean and nothing announces "ahead by 7" unless
  you ask. Use `git status -sb`.

- **A REPO WITH NO `node_modules` PRESENTS EXACTLY LIKE A BROKEN REPO.** Six repos failed
  build/typecheck/test purely because install had never run there. Check the install before
  debugging the code.

---

## 6. CHANGELOG

### 2026-09-13 — the store client could not be constructed at all

Found by a user running the feature, not by any gate.

- **Blast radius was wider than the report.** The throw is in `createClient`, and the factory is
  shared — so every store IPC was broken. The launch was simply the path exercised first.
- **Measured in the runtime that actually breaks:** a probe inside the real main process returned
  `node=20.18.3 | typeof WebSocket=undefined | createClient=THREW`, and the same probe with an
  explicit transport returned OK.
- **The repo already knew — at two of three call sites.** A sibling file carries a long comment
  describing this exact trap. **A fix applied at two of three call sites is a latent outage at the
  third**, so the guard is now an invariant test, not a third copy of a comment.
- **Both fixes red-verified**, each restoring the tree byte-identically (sha compared).

**Left off:** E1 — the e2e isolation. Until then, treat e2e passes here as weak evidence.

### 2026-09-12 — a launched session now arrives with its project's env

- **The one architectural unknown was settled by MEASUREMENT.** If the terminal host lost a spawn's
  env when reusing an existing window, secrets would have had to go to disk — a different security
  design. Probe: 3/3 propagated, including against a running instance. Secrets go to the child
  process only; the launcher script stays inert.
- **Degrade, never block.** A locked console still opens a session and says so. The only outcome
  worse than no secrets is secrets that silently are not there.
- **Review returned REVISE and was right five times**, including on the lead's own code.

**The most important find of the day was not the feature.** Reviewing it surfaced B11: the delete
button removing the wrong secret, live for months.

---

## 7. DECISIONS

- **2026-09-13:** every main-process database client passes an explicit WebSocket transport, and an
  invariant TEST enforces it rather than a comment. A comment cannot fail a build.
- **2026-09-12:** secrets reach a launched session through the CHILD PROCESS ENV, never the
  launcher script — legitimate only because env propagation was measured, not assumed.
- **2026-09-12:** one merge algorithm for three surfaces. The trigger for extracting was the THIRD
  consumer: two copies is duplication, three is a divergence waiting to happen.
- **2026-08-25:** envelope encryption — a passphrase change re-wraps one record; device enrollment
  becomes an INSERT, not a migration.

---

## 8. TELEMETRY FIX LEDGER

| fingerprint | error + count | first seen | root cause | fix commit | status | if it recurs → start here |
|---|---|---|---|---|---|---|
| `a4f21c` | `Cannot read 'id' of undefined` @ /deploy ×412 | 2026-08-02 | list rendered before the fetch resolved | `9c1f0aa` | solved (2026-08-11) | the guard in `DeployList`, not the fetch |
| `77be03` | `NetworkError` @ /sync ×18 | 2026-09-09 | retry storm on a 502 from upstream | `3de77b1` | watching (until 2026-09-16) | backoff in `syncClient`, confirm none after the deploy |
