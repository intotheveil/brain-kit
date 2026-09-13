# 🧠 BRAIN — <product name>

> This is the single source of truth for this product. It is read BEFORE any work and
> written AFTER any work. If something here is wrong, fix it HERE — do not carry the correct
> version around in a chat. Any Claude session (chat or Claude Code) starts by reading this
> file and ends by updating it. Knowledge lives here, not in conversation history.
>
> **The rule that makes this work:** investigate once, write it here, never re-investigate.
> If you find yourself re-discovering something you (or a past session) already worked out,
> that's a signal it was missing from this brain — add it.

**Last updated:** <YYYY-MM-DD> by <session ref>
**Status:** <live | in-development | paused | maintenance-only>
**Repo:** <path / git remote>   ·   **Deployed:** <url or "not deployed">

---

## 1. WHAT THIS IS  (never-changes context — read first, every time)

<One paragraph: what the product does, who it's for, what "done/working" means.
This is what a cold session needs to not be cold. Keep it current but stable.>

---

## 2. ARCHITECTURE  (the canonical technical truth — investigate ONCE, record here)

> This section exists to KILL re-investigation. Every time a session has to figure out
> "how does X work / where does Y live / what's the schema", the answer goes here so no
> future session ever has to figure it out again.

- **Stack:** <framework, db, hosting, key libs>
- **Data model:** <tables / key entities / where the schema lives (migration path)>
- **Key modules / where things live:** <the map — what's in which directory, entry points>
- **External services / keys:** <Supabase project, APIs, what env vars exist — NOT the values>
- **How to run / build / test / deploy:** <the actual commands>
- **Integration points:** <what talks to what>

---

## 3. CURRENT STATE  (what's true RIGHT NOW — the thing a resuming session reads)

> The "where was I" answer. Update this every session so returning after 3 weeks takes
> 30 seconds, not 30 minutes.

- **What's live / working:** <...>
- **What's in progress:** <the thing currently half-done, and exactly where it stands>
- **What's next / planned:** <the intended next moves, in priority order>

---

## 4. OUTSTANDING  (bugs · feedback · requests · known issues — the triage queue)

> Everything owed on this product. New items append here (or arrive via central intake and
> get routed here). Severity: 🔴 critical · 🟠 important · 🟡 minor · 🔵 idea/nice-to-have.
> When done, move to the CHANGELOG (§6), don't just delete — the trail matters.

| id | sev | type | summary | status | added |
|----|-----|------|---------|--------|-------|
| <B1> | 🔴 | bug | <what's broken, how to reproduce> | open | <date> |
| <F1> | 🔵 | feature | <requested addition> | open | <date> |
| <C1> | 🟠 | customization | <client-specific ask> | open | <date> |

---

## 5. GOTCHAS  (hard-won "don't do X, it breaks Y" — the knowledge that dies in old chats)

> This is the most valuable section and the one that's normally LOST. Every time you learn
> something the hard way — a fix that caused a regression, a non-obvious dependency, a thing
> that looks wrong but is intentional — write it here so it's never re-learned the hard way.

- <e.g. "Auth accounts must be created via the admin API, NOT raw SQL into auth.users —
  raw inserts produce a 500 on login. Learned 2026-07-09.">
- <e.g. "The RLS membership policy needs the SECURITY DEFINER helper or it infinite-recurses.">

---

## 6. CHANGELOG  (append-only — what happened, newest first)

> The session log. Every work session appends one entry. This replaces the lossy handover:
> a new session reads the last few entries and knows exactly what just happened and why.

### <YYYY-MM-DD> — <session ref>
- Did: <what changed>
- Decided: <any non-obvious choice + why>
- Resolved: <which OUTSTANDING items closed>
- Left off: <exact state handed to the next session — the "resume here" pointer>

---

## 7. DECISIONS  (dated ADR-lite — the "why", so it's never re-litigated)

- **<YYYY-MM-DD>:** <decision> — <one-line rationale>

---

## 8. TELEMETRY FIX LEDGER  (every production error we've closed — keyed by fingerprint)

> The close-out record for fleet-telemetry errors. When you fix a telemetry-surfaced error, add a row
> here (see the Telemetry-fix-ledger discipline in CLAUDE.md). On ANY new error, grep this table for its
> `fingerprint` FIRST — a hit means audit the prior effort and resume from its pointer, never re-investigate
> from scratch. Status: `watching (until <date>)` → `solved (<date>)` after 7 silent days post-deploy.

| fingerprint | error (short) + URL/count | first seen | root cause | fix commit | deployed | status | if it recurs → start here |
|-------------|---------------------------|-----------|------------|-----------|----------|--------|---------------------------|
| <fp> | <msg @ /route ×N> | <date> | <cause> | <sha> | <auto/manual> | watching (until <date>) | <where to resume> |
