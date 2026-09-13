# PROJECT CONSTITUTION — brain-kit

<!-- HAND-WRITTEN, not composed by kit.mjs. That is deliberate and is recorded as a decision in
     BRAIN.md §7: the kit's shared CORE half assumes tenant tables, migrations and a phased
     delivery arc, none of which exist in this repo. Installing it would hand every agent pages
     of inapplicable rules to grade against — the same defect the kit exists to prevent, only
     inverted. What IS kept is §0, verbatim from CLAUDE.core.md, because that part applies. -->

## 0. The loop (every session, no exceptions)

> This is what stops the brain from rotting. Reading and writing BRAIN.md is not optional
> housekeeping — it is the first and last step of every session. A session that skips it
> has broken the one rule that makes the whole system work.
>
> It is §0 because it governs *when everything below is read*. A rule that says "before doing
> ANY work, read BRAIN.md" cannot live at the bottom of the file.

1. **READ FIRST.** Before doing ANY work on this product, read `BRAIN.md` in full. Do not
   investigate the codebase for something the brain already documents (BRAIN.md §2 Architecture,
   BRAIN.md §5 Gotchas). If the brain answers it, use the brain. Re-investigating documented facts
   wastes time and tokens and risks a contradictory answer — the exact problem this prevents.

2. **WORK** — do the task.

3. **WRITE BEFORE ENDING.** Before the session ends, update BRAIN.md:
   - Append a BRAIN.md §6 CHANGELOG entry: what you did, what you decided, what you resolved, and the
     "left off" pointer for the next session.
   - Update BRAIN.md §3 CURRENT STATE to match reality now.
   - If you learned something the hard way, add it to BRAIN.md §5 GOTCHAS. This is mandatory — an
     unrecorded gotcha will be re-learned the hard way by a future session.
   - Move any resolved OUTSTANDING items from BRAIN.md §4 into the changelog.
   - If you made a non-obvious architectural choice, add it to BRAIN.md §7 DECISIONS.
   - Update the "Last updated" line.

4. **If you investigated something not in the brain** — the answer goes into BRAIN.md §2 (if it's a
   durable architectural fact) so it never has to be investigated again.

**Why this is enforced, not suggested.** The failure mode this prevents: knowledge scattering
across chats, lossy handovers when a chat gets too big, re-running investigation prompts that
burn tokens and sometimes contradict each other, and cold-start sessions with no context. The
brain is the cure ONLY if it is always current. A brain that's updated "usually" is worse than
useless, because you can't trust it, so you re-investigate anyway, and you're back to the
disease. Trust requires discipline: read every time, write every time.

**Handovers are dead.** There is no more "let me write a handover because this chat got too
big." The brain IS the handover, continuously. A new chat reads BRAIN.md and is immediately as
informed as the chat that got too big. Start new chats freely — nothing is lost.

---

## 1. What this repo is

**brain-kit** — a file-based memory discipline for coding agents, plus the generator and hooks
that keep it honest. Extracted from a private 13-repo fleet and generalized; published MIT.

It is a **public** repo. Everything committed here is world-readable: assume anything you write
will be read by a stranger evaluating whether to trust the method.

**Done, for a change here:** committed, **pushed**, and `bash test/verify-published.sh` still
green if anything shipped in a package changed.

---

## 2. Stack

No application stack, and that is not an omission — POSIX shell plus one Node ESM script, with
Node ≥ 18 the only runtime dependency. No framework, no database, no bundler, no test runner.
`test/verify-published.sh` is a shell harness on purpose: it verifies the PUBLISHED artifacts, so
it must not depend on anything in the working tree.

Full layout and the npm three-names arrangement are in `BRAIN.md` §2. Do not restate them here —
one source of truth, and it is the brain.

---

## 3. Non-negotiables

1. **No secrets, ever.** The only credential-shaped strings permitted are the scanners' own
   detection patterns in `hooks/secret-scan.sh`. Anything else is a leak in a public repo.
2. **No private fleet references.** No internal repo names, hostnames, project ids, emails or
   absolute local paths. Sweep before committing; the extraction was swept and must stay swept.
3. **A lesson in a comment is the point, not clutter.** Most comments in `kit.mjs` and the hooks
   describe a real incident. A rule without its reason gets deleted by the next person who finds
   it inconvenient. If you change behaviour, say what went wrong that made you change it.
4. **Verify against the registry, not the working tree.** A local file proves nothing about what a
   stranger installs.
5. **Push. "Done" means pushed** — a commit that never leaves one machine is not shipped.

---

## 8. Commands

```
verify:   bash test/verify-published.sh     # 39 checks against the PUBLISHED packages
compose:  node kit.mjs init|compose|apply|check <repo> [--fleet-root DIR]
hooks:    bash sync-hooks.sh [fleet-root] [--dry-run]
kit:      bash verify-kit.sh [fleet-root]
pack:     npm pack --dry-run                # what actually ships — check before publishing
syntax:   bash -n <script>                  # every shell script must parse
```

There is no `npm test`, no `lint` and no `typecheck` here, and nothing should pretend otherwise:
a gate that names a command which does not resolve either fails every agent or, worse, is skipped
in silence.

---

## 11. Project-specific reminders

- **`npm view <name>` returning 404 means UNREGISTERED, not publishable.** npm's name-similarity
  guard runs only at publish time. This cost us the name `brain-kit` after it had been reported as
  free (BRAIN.md §5).
- **A failed publish can still RESERVE the version**, and the registry's reads lag its writes. When
  a publish and a read disagree, `npm access list packages` is the owner-side view that tells the
  truth first.
- **Literal `|` inside a markdown table cell breaks the row — even inside backticks.** Both this
  repo's brain and its example contain tables.
- **`mktemp -d` hands back a POSIX path Windows `node` cannot resolve.** Keep test paths
  shell-parsed or Windows-resolvable.
- **Check `npm pack --dry-run` before publishing.** The `files` array is a promise; a template
  excluded from it works perfectly for you and breaks for everyone else.
- **This repo is a FORK of a private kit and nothing syncs them** (BRAIN.md §4 L4). Two
  divergences are deliberate — the root resolution and the `templates/` layout — and a naive copy
  from upstream would regress both.
