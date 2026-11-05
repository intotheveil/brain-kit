# The receipts: what this looks like after months of real use

Everything in this repo was pulled out of a private fleet of repositories that has run the
`BRAIN.md` discipline and the agent crew every working day since July 2026. This page is the
evidence: counts taken straight from those repos' brains, build logs and git history on
**2026-11-05**. The repos are private, so names are left out. The counting method is spelled out
under each number so you can judge how far to trust it.

Nothing here is estimated upward. Where a count is noisy, the method says so, and the number given
is the conservative one.

## The table

| What | Count | How it was counted |
|---|---:|---|
| Repos running the brain | **53** | Every git repo with a brain file: 25 product, infrastructure and library repos plus 28 game repos. Worktrees and scratch copies are excluded (see below). |
| Time span | **118 days** | First commit that added a `BRAIN.md` (2026-07-10) to 2026-11-05. |
| Commits that touched a brain | **3,142** | `git log -- BRAIN.md BRAIN-ARCHIVE.md brain/` per repo, summed. That is **~35%** of all 8,984 commits in those repos. |
| §6 changelog entries | **~1,490** | Session entries (`###` headings, or dated bullets where a brain uses those) under every CHANGELOG heading, in `BRAIN.md`, its archive and any sub-brain files. |
| §5 gotchas | **~2,610** | Top-level entries under every GOTCHAS heading, in the same files. |
| §7 decisions | **~820** | Top-level entries under every DECISIONS heading, in the same files. |
| Repos keeping a `BUILD_LOG.md` | **17** | The repos the full builder → qa → reviewer crew works in. (Most game repos run a lighter crew without a build log.) |
| BUILD_LOG entries | **~2,020** | Headings of level 2 to 4 that carry a date or task number. |
| Entries recording a **qa VALIDATED** | **364** | Entries containing `VALIDATED`. |
| Entries recording a **qa FAILED** | **57** | Entries where `qa`/`QA` and `FAILED`/`FAIL`/`FAILURES` sit within 80 characters on one line. |
| Entries recording a **reviewer PASS** | **246** | Entries where `review…` and `PASS` sit within 80 characters on one line. |
| Entries recording a **reviewer REVISE** | **296** | Entries containing `REVISE`. |
| Entries recording a **BLOCKED** task | **75** | Entries containing `BLOCKED`. |
| Largest single `BRAIN.md` | **~911 KB / ~6,500 lines** | Byte size of the file on disk (an internal operations web app). |
| Largest brain overall | **~3.3 MB** | One repo split its brain into a small hub plus per-area sub-brains and monthly changelog files. That repo has 2,506 commits, and 813 of them touched the brain. |
| Tests in the biggest repo | **8,098** | The most recent full-suite run recorded in that repo's BUILD_LOG (463 test files). A static count of `it(`/`test(` calls across its 658 test files gives ~9,800. |
| Repos with an agent crew installed | **46 of 53** | Repos with a `.claude/agents/` directory. |

## What the numbers mean

- **The gate catches real work, not hypotheticals.** In 57 build-log entries an independent `qa`
  agent ran the checks and **failed work that the builder had reported as done**. In 296 entries
  the reviewer sent the work back with REVISE. REVISE appears in more entries than PASS because
  a task often goes through several review rounds before the one that passes. Without the gate,
  each of those would have been merged as "done".
- **The brain is written all the time, not once.** About one commit in three touches a brain.
  That is §0 doing its job: read first, write before ending, every session.
- **Gotchas pile up faster than anything else.** At ~2,600 gotchas against ~1,500 sessions, an
  average session writes down more than one hard-won lesson. Each of those is a mistake that
  should now happen only once. Some of the best ones are in the
  [Hall of Gotchas](hall-of-gotchas.md).
- **The brain grows with the product, and this kit was changed to cope.** The busiest repo's brain
  passed 1 MB, which broke a tool that read it (gotcha #18 in the Hall). That repo then split its
  brain into a hub plus sub-brains. The rule became "keep only what is current in `BRAIN.md`,
  and move the rest verbatim to an archive".
- **The discipline survives a change of domain.** The same files and the same loop run in web
  apps, a desktop app, firmware, data pipelines, research code and game projects in four engines.

## What was counted, and what wasn't

- **Included:** every git repository directly under the fleet's projects folder that has a
  `BRAIN.md` (25), and every game repo listed in the fleet catalogue whose local checkout exists
  and has a brain file (28 of 28).
- **Excluded:** 26 directories that are git worktrees or scratch copies of an included repo
  (they would double-count the same history), one static website repo with no brain, and
  directories that are not git repositories.
- **Undercounts:** seven game repos started with free-form brain files before the numbered layout
  (§5/§6/§7) existed. Their gotchas, changelog entries and decisions are only partly counted or not
  counted at all, but their brain commits are. Retired material moved verbatim into an archive
  file is counted once, where it now lives.
- **Verdict counts are per entry.** A build-log entry that mentions VALIDATED twice counts once.
  An entry can count toward more than one verdict, for example "qa FAILED on check 9, everything
  else VALIDATED". The regexes match the words people write in practice, so they can miss
  unusual phrasings. Treat these counts as lower bounds.
- Everything was read-only: file reads plus `git log`. No repository was modified to produce
  this page.

## Raw numbers

```json
{
  "as_of": "2026-11-05",
  "repos_with_brain": 53,
  "repos_by_kind": { "product_infra_library": 25, "game": 28 },
  "first_brain_commit": "2026-07-10",
  "days_running": 118,
  "brain_commits": 3142,
  "all_commits_in_those_repos": 8984,
  "changelog_entries": 1490,
  "gotchas": 2611,
  "decisions": 824,
  "repos_with_build_log": 17,
  "build_log_entries": 2018,
  "qa_validated_entries": 364,
  "qa_failed_entries": 57,
  "reviewer_pass_entries": 246,
  "reviewer_revise_entries": 296,
  "blocked_entries": 75,
  "largest_single_brain_bytes": 910692,
  "largest_single_brain_lines": 6504,
  "largest_brain_total_bytes": 3302538,
  "biggest_repo_commits": 2506,
  "biggest_repo_brain_commits": 813,
  "biggest_repo_tests_last_full_run": 8098,
  "biggest_repo_test_files": 658,
  "repos_with_agent_crew": 46
}
```
