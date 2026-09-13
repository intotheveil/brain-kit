# BRAIN DISCIPLINE

> Drop this into each repo's `.claude/CLAUDE.md` (or `AGENTS.md`, or whatever file your
> agent reads first). It is the whole method in one page; everything else in this kit
> exists to keep it honest.

> This is what stops the brain from rotting. Reading and writing BRAIN.md is not optional
> housekeeping — it is the first and last step of every session. A session that skips it
> has broken the one rule that makes the whole system work.

## The loop (every session, no exceptions)

1. **READ FIRST.** Before doing ANY work on this product, read `BRAIN.md` in full. Do not
   investigate the codebase for something the brain already documents (§2 Architecture,
   §5 Gotchas). If the brain answers it, use the brain. Re-investigating documented facts
   wastes time and tokens and risks a contradictory answer — the exact problem this prevents.

2. **WORK** — do the task.

3. **WRITE BEFORE ENDING.** Before the session ends, update BRAIN.md:
   - Append a §6 CHANGELOG entry: what you did, what you decided, what you resolved, and the
     "left off" pointer for the next session.
   - Update §3 CURRENT STATE to match reality now.
   - If you learned something the hard way, add it to §5 GOTCHAS. This is mandatory — an
     unrecorded gotcha will be re-learned the hard way by a future session.
   - Move any resolved OUTSTANDING items from §4 into the changelog.
   - If you made a non-obvious architectural choice, add it to §7 DECISIONS.
   - Update the "Last updated" line.

4. **If you investigated something not in the brain** — the answer goes into §2 (if it's a
   durable architectural fact) so it never has to be investigated again.

## Why this is enforced, not suggested

The failure mode this prevents: knowledge scattering across chats, lossy handovers when a
chat gets too big, re-running investigation prompts that burn tokens and sometimes contradict
each other, and cold-start sessions with no context. The brain is the cure ONLY if it is
always current. A brain that's updated "usually" is worse than useless, because you can't
trust it, so you re-investigate anyway, and you're back to the disease. Trust requires
discipline: read every time, write every time.

## Handovers are dead

There is no more "let me write a handover because this chat got too big." The brain IS the
handover, continuously. A new chat reads BRAIN.md and is immediately as informed as the chat
that got too big. Start new chats freely — nothing is lost.

## Telemetry fix ledger (optional — close the loop on every production error)

Skip this section if you have no production error reporting. If you do — Sentry, a `fleet_errors`
table, whatever you use — errors from the DEPLOYED app are grouped by some stable
**`fingerprint`** (typically a hash of product + message + top stack frame). This is the brain
discipline applied to production errors: investigate a fingerprint once, record the close-out,
never re-triage it.

- **When you fix a telemetry-surfaced error**, record it in `BRAIN.md` **§8 TELEMETRY FIX LEDGER**
  (create §8 if absent): `fingerprint · short error + URL/count · first-seen · root cause · fix commit ·
  deployed · status · "if it recurs → start here"` pointer.
- **Verify it goes quiet, then 7 silent days = solved.** Most telemetry stores are append-only, so a
  deploy only stops NEW occurrences — old rows do not disappear. Confirm none is timestamped AFTER
  the deploy; a shrinking count is not evidence. No new occurrence for 7 days →
  flip the ledger status `watching → solved` and mark the fingerprint resolved in your tracker. A
  recurrence inside the window means the fix didn't take — reopen, don't start fresh.
- **On ANY new error, grep §8 for its fingerprint FIRST.** A known fingerprint = audit the prior close-out
  and resume from its pointer. Never re-investigate a previously-fixed fingerprint from scratch.
