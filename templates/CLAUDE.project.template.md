<!-- KIT:PROJECT v1 — the PER-REPO half of .claude/CLAUDE.md.

     Everything in this file belongs to the repo and is NEVER overwritten by `kit sync`.
     Fill the placeholders from the repo's SPEC/BRAIN. If a value cannot be determined,
     leave the placeholder and say so — a wrong command here is worse than a missing one,
     because the SubagentStop gate runs what §8 declares.

     Section numbers interleave with CLAUDE.core.md (§0 §3 §4 §5 §6 §7 §9 §10). Do not
     renumber: reviewer/planner/qa cite §6 and §9 by number in every repo.
-->

<!-- KIT:PROJECT:BEGIN §1 -->
## 1. What this project is

- **Product:** <NAME — one line, human-facing>
- **Repo:** <slug — how git finds it>
- **Users:** <who actually uses it>
- **Definition of done for a feature:** merged to the default branch, tests pass, migration
  applied cleanly on a fresh DB, no console errors, feature reachable in the UI.
<!-- KIT:PROJECT:END §1 -->

<!-- KIT:PROJECT:BEGIN §2 -->
## 2. Stack (do not deviate without an ADR)

<!-- House stack unless this repo has an ADR saying otherwise. A repo that deviates MUST
     point at the ADR here, by date and title, e.g. "see DECISIONS.md ADR-0001". An
     undeclared deviation reads exactly like a repo that missed a sync. -->

- Frontend: React + Vite + TypeScript + Tailwind
- Backend/data: Supabase (PostgreSQL), Row-Level Security on **every** tenant table
- Auth: Supabase Auth
- Tests: <unit runner> + <e2e runner>. A feature without tests is not done.
- Package manager: **npm** — npm only, never introduce pnpm/yarn/bun lockfiles.
- Hosting/deploy: <target>
- Migrations: local timestamped SQL files committed to the repo (the archive) AND applied
  live. The committed files are the source of truth.

**Deviations from the house stack:** <none | ADR-#### in DECISIONS.md, one line why>
<!-- KIT:PROJECT:END §2 -->

<!-- KIT:PROJECT:BEGIN §8 -->
## 8. Commands

<!-- These are not documentation — the SubagentStop gate RUNS them. A command named here
     that does not exist fails every agent; a command that exists but is not named here is
     never enforced. Keep this exact. -->

```
install:    npm install
dev:        npm run dev
build:      npm run build
test:       npm test
e2e:        <npm run e2e | not defined yet>
migrate:    <supabase db push | project-specific>
lint+types: npm run lint && npm run typecheck
```

> Whatever test stack this project chooses, wire it as the `test` (and `e2e` where
> relevant) npm script so the gate can enforce it. A project that has not defined tests
> yet must define them as part of its first milestone.
<!-- KIT:PROJECT:END §8 -->

<!-- KIT:PROJECT:BEGIN §11 -->
## 11. Project-specific reminders

<!-- The high-frequency gotchas from BRAIN.md §5 — the handful worth paying for in every
     session's context. Not a second brain: link to BRAIN.md for the rest. Keep it short
     enough that it is actually read. -->

- <the framework/runtime fact that contradicts training data, if any>
- <the banned anti-pattern in this repo, and what to use instead>
- <the file that bypasses RLS / holds privilege, and the rule about it>
- **Secrets:** env var NAMES only in tracked files. `.env` is gitignored; never stage it.
<!-- KIT:PROJECT:END §11 -->
