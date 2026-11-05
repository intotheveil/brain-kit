# Hall of Gotchas

A prompt tells an agent what you hope it will do. A gotcha records what actually went wrong, why,
and the check that would have caught it, and the next session reads it before it starts work.
Write it down once and nobody learns it the hard way again, which no amount of prompting can
promise.

These are real incidents from the `§5 GOTCHAS` sections and build logs of a private fleet of
repositories that has run this kit daily since July 2026 (see [the receipts](receipts.md)). The
details are trimmed and the products left unnamed, but every one happened. They are ordered
roughly by how likely they are to happen to you.

---

### 1. 1,141 tests green, and the CLI died on `--help`

A command-line tool that loads secrets into the environment from an encrypted vault passed
typecheck, lint and all 1,141 tests, then crashed the first time it was actually run. It had
imported a value from a workspace package's `export *` barrel. Under true Node ESM that import
throws "does not provide an export named". The same import works from CommonJS, and the test
runner aliased the package to its source, so none of the green checks ever crossed the real
module boundary. It was the third crash from the same root cause.

**The rule it became:** running the real binary is part of the release check, and a static gate
now fails any value import from a bare workspace barrel. The gate targets the whole class of
bug, not just the instance.

`tooling` `testing`

### 2. The launcher that passed both gates and launched a blank session

A desktop console's button for starting an agent session with a written brief passed qa and
review. The first real click opened a plain session with no brief. The CLI flag before the brief
takes a list of values, so it swallowed the brief as an extra directory. The test ran in headless
mode, where a different flag ended that list, so it never saw the problem. After the fix the
second real click failed too: the terminal → shell hand-off silently dropped positional arguments.

**The rule it became:** if a task produces something that runs, exercise it for real and record
what you observed. A `{ok: true}` return value only proves the code returned.

`testing` `agents`

### 3. `| tail` turned a failing suite into exit code 0

`npm run e2e | tail` printed `exited with code 0` right below a line that said `1 failed`. The
exit status was `tail`'s, not the suite's. A related trap: a probe that counted `"error  "` in
eslint output read 0 errors because Git Bash output was full of ANSI colour codes, while eslint had
printed two.

**The rule it became:** a gate checks the exit code (`set -o pipefail`, or capture `$?` before you
filter). It never greps output that might be coloured.

`tooling`

### 4. A parser that split on `'\n'` returned nothing on CRLF files

A markdown parser split on `'\n'`, so on a CRLF file every anchored regex stopped matching. It
returned zero sections and zero open items, and showed a blank dashboard instead of an error. The
machine had `core.autocrlf=true` set, so every file checked out there was CRLF. Any file committed
from a Windows machine would have blanked the view for everyone.

**The rule it became:** handle CRLF in the parser (split on CRLF, CR or LF). Never rely on no
Windows machine ever writing the file.

`data` `tooling`

### 5. The e2e suite tested yesterday's build

An independent QA run failed a keyboard-focus e2e test on a bug that had already been fixed and
merged. The e2e harness launches the checkout's own build output and never rebuilds it. That
output had been built 17 minutes before the fix was merged. The builder's "green in my worktree"
was true, but only for that worktree's build.

**The rule it became:** run the build in the checkout under test right before any e2e run.

`testing`

### 6. The database migration CLI exits 0 when nothing ran

`supabase db push` skips any migration file whose name doesn't match its timestamp pattern. It
prints "Skipping migration" and exits successfully. Four repos had numbered their migrations
`001_…` and listed `db push` as their migrate command, one of them with 346 migration files. Any
agent following those instructions would have believed its migration was applied. Separately,
the CLI also exits 0 when a helper binary it needs is missing.

**The rule it became:** with this CLI a clean exit is never evidence. Check the database
catalogue to confirm that the trigger, function or index actually exists.

`tooling` `data`

### 7. A formatter hook that silently did nothing for 17 days

A shared post-edit hook ran `npx --no-install prettier … || true` and then `exit 0`. With the
package missing, `npx --no-install` exits 0 anyway, the output went to `/dev/null`, and `|| true`
swallowed the rest. On one machine the hook did nothing for 17 days, and on another it reformatted
246 files to the defaults. Both looked exactly like a hook that was working.

**The rule it became:** a hook must be able to tell "ran and did nothing" apart from "never ran".
A hook that swallows its own failure is indistinguishable from one that works.

`tooling` `agents`

### 8. `tsc --build` exited 0 for code it never typechecked

A QA agent deleted an entry from a package's `exports` map on purpose. `tsc --build` exited 0 and
all 1,142 tests passed, while the background service that used that entry would have crashed on
launch. The two Node ESM apps were outside the TypeScript project-reference graph, and the test
runner resolved packages from source, so no root gate ever read the real package boundary.

**The rule it became:** before trusting a gate, prove it can fail. Break the thing on purpose and
check that the gate turns red.

`testing` `tooling`

### 9. 1,100+ tests, a QA pass and a review all missed silent data loss

A Remove action on a settings screen could delete the **wrong** secret when two config files of
the same product held the same key name. When a test deliberately broke the code by dropping the
field that tells those rows apart, all 15 existing tests stayed green. Every product in the test
fixture owned exactly one config file, so the field never made a difference in any test.

**The rule it became:** when a field distinguishes two rows, the fixture must contain two rows that
differ ONLY in that field.

`testing` `data`

### 10. The deliberate bug that changed nothing

To prove a coverage hole, an agent injected a bad value into an object literal and the suite stayed
green. But a spread later in the same literal overwrote the injected value, so the code under test
had not changed at all. When the same value was really broken, 15 tests across 4 files failed. A
mutation that changes nothing looks exactly like a test that checks nothing, and the two need
opposite fixes.

**The rule it became:** before believing that a mutation survived, assert that the mutated file
actually differs, or make the mutation throw so that a no-op cannot hide.

`testing`

### 11. Tests that compared two outputs missed a changed constant

Every test of an error-grouping fingerprint asserted relationships: the same inputs group together
and different inputs stay apart. When the separator constant was changed on purpose, 7 tests that
pinned exact values failed and **0 of the 14 relational tests did**. Both sides of each comparison
moved together, while in production every stored fingerprint would quietly have stopped matching.

**The rule it became:** when an output is stored as a key, pin the literal value. Relational tests
are useful, but they do not replace that.

`testing`

### 12. The e2e suite passed on a different working tree

The Playwright config had `reuseExistingServer: true`, so a dev server left running by an earlier
session was serving **its** directory, and the suite passed against code that was not under test.
A related trap: `vite preview --port 4173` silently moves to 4174 when 4173 is taken, and the test
runner then waits on a port that nothing serves.

**The rule it became:** use `reuseExistingServer: false` plus `--strictPort`. A port that is
already taken should abort the run, not adapt.

`testing` `tooling`

### 13. "Typecheck clean in my worktree", and main failed

A builder agent reported a clean typecheck in its own worktree. After the merge, main's typecheck
failed on two wrongly typed values in the builder's new test file. The test runner does not
typecheck, so the suite had been green the whole time.

**The rule it became:** after merging an agent's branch, re-run typecheck and the affected tests
on main. Treat a worktree's claim as unverified until main confirms it.

`agents`

### 14. Two builders in one checkout failed each other's gate

The end-of-task gate runs the whole suite in the shared working tree. Agent A's work in progress
(a source change whose matching test update hadn't landed yet) failed agent B's gate on code B
never touched, and B could not tell the difference. In another case, two branches were each green
on their own but broke each other after merging, because one added a heading that the other's
exact-order test did not expect.

**The rule it became:** one writer per checkout. Builders that run in parallel each get their own
git worktree. In the fleet, the gate now also takes a lock and fails fast when a second gate starts
in the same tree.

`agents`

### 15. Writing the lesson down did not stop the mistake

An agent used `git checkout --` to revert its own failed edit and destroyed another agent's
uncommitted work: a new gate check. Later in the same session it did it again, this time wiping an
entire feature's UI, even though it had already recorded the lesson after the first loss. The note
was a caution, and a caution did not change what the agent did.

**The rule it became:** state the rule as an action. Snapshot to a uniquely named scratch file
before you mutate, and revert from that file, never from git unless the file is clean. Better
still, commit the agent's work first.

`agents`

### 16. An agent restored a file from another agent's `.bak`

Parallel crew agents shared one session scratchpad. A builder restoring a file after a mutation
test copied a stale, generically named `.bak` (left by a different task) over a product page. It
was caught only because the builder re-checked its own diff.

**The rule it became:** back up to uniquely named files. Verify every restore with `git diff` or
a hash, and re-run the tests of the task next door.

`agents` `tooling`

### 17. Removing a worktree deleted main's `node_modules`

A builder agent had linked its worktree's entire `node_modules` to the main checkout's with a
directory junction. A later `git worktree remove --force` deleted *through* the junction, and main
lost `.bin` along with whole scopes of packages. `npm install` could not repair it because a
running app held a file lock.

**The rule it became:** link only the specific workspace packages a worktree needs, never all of
`node_modules`. Check that it is not a reparse point before removing a worktree.

`agents` `tooling`

### 18. The busiest product's brain vanished first

A dashboard read every repo's `BRAIN.md` through the GitHub contents API. That API returns the file
inline as base64 only below 1 MB. Above that, `content` comes back empty with `"encoding": "none"`.
The busiest product's brain passed 1,000,000 bytes, and from then on the dashboard showed "Brain
unavailable" for it every day, while every smaller product kept working. The failure grew with
success.

**The rule it became:** request the raw media type (`Accept: application/vnd.github.raw`) for any
file that can grow, and keep only what is current in the brain, moving history to an archive.

`deploy` `data`

### 19. A package version that stays broken forever

This kit's first npm release depended on a package name that npm's name-similarity guard then
refused to publish. The dependency could never resolve. npm does not allow unpublishing after 72
hours, so the broken version stays on the registry permanently. It is deprecated with a pointer,
and `latest` resolves correctly.

**The rule it became:** the repo can be healthy while the artifact is broken. CI now installs the
*published* packages from the registry on a schedule, ignoring the working tree.

`deploy` `tooling`

---

Each of these entries started as a single line in a `§5 GOTCHAS` section, written by the session
that got burned. That line is the whole mechanism: the next session reads it before it does
anything, and does not get burned again.

Every entry is also a ready-to-share image card (1200×675) in [`docs/cards/`](cards/), generated
from this file by `scripts/cards/render.cjs`, so a card never says something this page does not.
