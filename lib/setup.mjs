// setup.mjs — `agent-brain-kit setup [dir]`: install everything into ONE repo, in one shot.
//
//   BRAIN.md                       from templates/BRAIN.template.md
//   .claude/CLAUDE.md              the brain loop (minimal), or the full constitution (--full)
//   .claude/agents/*.md            the crew (skip with --no-crew)
//   .claude/hooks/*.sh             the hooks (skip with --no-hooks)
//   .claude/settings.json          hook wiring, MERGED into an existing file — never clobbered
//
// THE ONE RULE: SETUP NEVER OVERWRITES A FILE. Every target that already exists is reported
// `kept` and left byte-for-byte alone — including a hook or agent that differs from the kit's
// copy, because a repo that edited its own guard.sh did so for a reason this tool cannot see.
// The single exception is settings.json, which is MERGED (hooks added, nothing removed) after
// a one-time backup, because a settings file is shared by everything else the repo wires and
// "kept, so your hooks silently never run" would be the worse failure.
//
// Running it twice is the test: the second run must create nothing and change nothing.

import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync, statSync, readdirSync } from 'node:fs';
import { join, resolve, basename, dirname, relative } from 'node:path';
import { parseBlocks, renderBlocks, sortedKeys } from './blocks.mjs';
import { c } from './term.mjs';

const HOOKS = ['_json.sh', 'brain-check.sh', 'format.sh', 'guard.sh', 'notify.sh', 'secret-scan.sh', 'subagent-gate.sh'];
const FLAGS = new Set(['--full', '--no-crew', '--no-hooks', '--dry-run']);

export async function run(args, KIT) {
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const unknown = [...flags].filter((f) => !FLAGS.has(f));
  if (unknown.length) {
    console.error(`setup: unknown flag ${unknown.join(' ')}\nusage: agent-brain-kit setup [dir] [--full] [--no-crew] [--no-hooks] [--dry-run]`);
    return 2;
  }
  const positional = args.filter((a) => !a.startsWith('--'));
  if (positional.length > 1) {
    console.error(`setup: one directory at a time (got ${positional.length}: ${positional.join(' ')})`);
    return 2;
  }
  // AN EMPTY ARGUMENT IS NOT "THE CURRENT DIRECTORY". `setup "$DIR"` with an unset $DIR passes
  // "", and resolve("") is the cwd — the first smoke run of this command did exactly that and
  // installed the crew into the kit's own checkout. Refuse it; omit the argument to mean cwd.
  if (positional.length === 1 && positional[0].trim() === '') {
    console.error('setup: the directory argument is EMPTY (an unset variable?). Omit it to mean the current directory.');
    return 2;
  }
  const dir = resolve(positional[0] ?? process.cwd());
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    console.error(`INCONCLUSIVE: no directory at ${dir}. setup installs into an existing repo; create it first.`);
    return 2;
  }
  const DRY = flags.has('--dry-run');
  const FULL = flags.has('--full');
  // A repo carrying .claude/.no-crew-hooks has DECLARED it does not run the crew kit — the same
  // marker sync-hooks.sh and sync-agents.sh honour. setup honours it too, rather than being the
  // one installer that quietly ignores a written opt-out.
  const OPTED_OUT = existsSync(join(dir, '.claude', '.no-crew-hooks'));
  const CREW = !flags.has('--no-crew') && !OPTED_OUT;
  const HOOKED = !flags.has('--no-hooks') && !OPTED_OUT;
  const name = basename(dir);
  // LOCAL date, not toISOString(): in any timezone ahead of UTC that is yesterday for part of
  // every day, and the very first doctor run then calls a brain written a minute ago 'yesterday'.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // ── read every source BEFORE writing anything ─────────────────────────────────────────
  // A missing template must stop the run with nothing written, not half-install a repo and
  // then complain. (A `files` array that forgot a directory is exactly how that would happen.)
  const src = (...p) => join(KIT, ...p);
  const need = [src('templates', 'BRAIN.template.md'), src('CLAUDE.core.md')];
  if (FULL) need.push(src('templates', 'CLAUDE.project.template.md'));
  if (HOOKED) need.push(src('templates', 'settings.template.json'), ...HOOKS.map((h) => src('hooks', h)));
  const agentFiles = CREW && existsSync(src('agents')) ? readdirSync(src('agents')).filter((f) => f.endsWith('.md')).sort() : [];
  const missing = need.filter((p) => !existsSync(p));
  if (CREW && agentFiles.length === 0) missing.push(src('agents', '*.md'));
  if (missing.length) {
    console.error(`INCONCLUSIVE: the kit is incomplete — nothing was written. Missing:\n${missing.map((m) => `  - ${m}`).join('\n')}`);
    return 2;
  }
  const lf = (s) => s.replace(/\r\n?/g, '\n');
  const read = (p) => lf(readFileSync(p, 'utf8'));
  const coreBlocks = parseBlocks(read(src('CLAUDE.core.md')));
  if (!coreBlocks.has(0)) {
    console.error('INCONCLUSIVE: CLAUDE.core.md has no §0 block (the brain loop) — nothing was written.');
    return 2;
  }

  // ── the plan ──────────────────────────────────────────────────────────────────────────
  // Each step: { rel, group, content | settings, exec } — computed in full before any write,
  // so --dry-run prints exactly what a real run would do.
  const steps = [];

  const brain = read(src('templates', 'BRAIN.template.md'))
    .replace('<product name>', name)
    .replace(/\*\*Last updated:\*\* <YYYY-MM-DD> by <session ref>/, `**Last updated:** ${today} by agent-brain-kit setup — template, not yet filled`);
  steps.push({ rel: 'BRAIN.md', group: 'brain', content: brain });

  // CLAUDE.md: Claude Code reads ./CLAUDE.md AND ./.claude/CLAUDE.md. If the repo already has
  // either, that one is the constitution and setup does not add a second beside it.
  const existingClaude = ['.claude/CLAUDE.md', 'CLAUDE.md'].find((p) => existsSync(join(dir, p)));
  if (existingClaude) {
    const note = loopNote(join(dir, existingClaude));
    steps.push({ rel: existingClaude, group: 'claude', content: null, note, warn: /NO brain loop/.test(note) });
  } else {
    steps.push({ rel: '.claude/CLAUDE.md', group: 'claude', content: FULL ? fullClaude() : minimalClaude(), note: FULL ? 'full constitution (fill §1 §2 §8 §11)' : 'brain loop' });
  }
  if (FULL) {
    steps.push({ rel: '.claude/CLAUDE.project.md', group: 'claude', content: projectHalf(), note: 'your half — fill, then `apply`' });
  }

  if (CREW) for (const f of agentFiles) steps.push({ rel: `.claude/agents/${f}`, group: 'agents', content: read(src('agents', f)) });
  if (HOOKED) {
    for (const h of HOOKS) steps.push({ rel: `.claude/hooks/${h}`, group: 'hooks', content: read(src('hooks', h)), exec: true });
    steps.push({ rel: '.claude/settings.json', group: 'settings', settings: JSON.parse(read(src('templates', 'settings.template.json'))) });
  }

  // ── resolve each step to a status, then (unless dry) act ──────────────────────────────
  for (const s of steps) {
    const abs = join(dir, s.rel);
    if (s.settings) { resolveSettings(s, abs); continue; }
    if (s.content === null || existsSync(abs)) {
      s.status = 'kept';
      // Only kit-owned files (agents, hooks) are worth flagging when they differ: BRAIN.md and
      // CLAUDE.md are SUPPOSED to diverge from the template the moment anyone uses them.
      const kitOwned = s.group === 'agents' || s.group === 'hooks';
      if (kitOwned && existsSync(abs) && lf(readFileSync(abs, 'utf8')) !== s.content) s.note = 'differs from the kit — left alone';
      else if (!kitOwned && s.content !== null) s.note = undefined;
      continue;
    }
    s.status = 'created';
  }

  if (!DRY) {
    for (const s of steps) {
      const abs = join(dir, s.rel);
      if (s.status === 'created') {
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, s.settings ? JSON.stringify(s.merged, null, 2) + '\n' : s.content, 'utf8');
        if (s.exec) { try { chmodSync(abs, 0o755); } catch { /* reason: chmod is a no-op on some filesystems; bash runs the hook either way */ } }
      } else if (s.status === 'merged') {
        const backup = abs + '.pre-brain-kit';
        if (!existsSync(backup)) writeFileSync(backup, readFileSync(abs));
        writeFileSync(abs, JSON.stringify(s.merged, null, 2) + '\n', 'utf8');
        s.note = `${s.note} (backup: settings.json.pre-brain-kit)`;
      }
    }
  }

  report(steps, { dir, name, DRY, FULL, CREW, HOOKED, OPTED_OUT });
  return 0;

  // ── helpers (closures over the run's state) ────────────────────────────────────────────

  function minimalClaude() {
    const crew = CREW ? `

## The crew

\`.claude/agents/\` holds seven subagents: ${agentFiles.map((f) => '`' + f.replace(/\.md$/, '') + '`').join(', ')}.
The rules they share, and the reason each exists:

- **The builder never certifies its own work.** \`qa\` PROVES it with checks it ran itself and
  trusts nothing it did not run; \`reviewer\` judges quality only AFTER qa says VALIDATED.
- **\`planner\` ends every phase with a QA task and a Review task.** A phase without both is
  not a plan.
- **One writer per checkout.** Code-producing agents running in parallel each get their own git
  worktree (\`isolation: worktree\`); two builders in one tree share one index and one suite,
  and each one's half-done change turns the other's gate red.
- The agents carry a default review rubric and phase arc. A full constitution (\`setup --full\`,
  or \`agent-brain-kit compose\`) adds §6 and §9, which then win.

Agents look for this repo's build, test and lint commands under a **Commands** heading in this
file. Add one — the SubagentStop gate runs \`typecheck\`, \`lint\` and \`test\` npm scripts where
they exist, and \`.claude/gate.conf\` declares anything else.` : '';
    return `<!-- Written by agent-brain-kit setup on ${today}. This file is YOURS: setup never
     overwrites it. It holds the minimum that makes a brain work — the read-first / write-before-
     ending loop. For the full constitution (non-negotiables, crew dispatch, review rubric,
     phase arc), run setup with --full in a repo without a CLAUDE.md, or compose one with
     \`agent-brain-kit init|apply\`. -->

# PROJECT CONSTITUTION — ${name}

${coreBlocks.get(0).body}${crew}
`;
  }

  function projectHalf() {
    return `<!-- KIT:PROJECT v1 for ${name} — written by agent-brain-kit setup --full on ${today}.
     Sections here are OWNED BY THIS REPO and are never overwritten by kit sync.
     Fill every <placeholder>, then: agent-brain-kit apply ${name} --fleet-root <parent dir> -->

${renderBlocks(parseBlocks(read(src('templates', 'CLAUDE.project.template.md'))))}
`;
  }

  function fullClaude() {
    const proj = parseBlocks(read(src('templates', 'CLAUDE.project.template.md')));
    const merged = new Map([...coreBlocks, ...proj]);
    return `<!-- GENERATED by brain-kit setup --full — do not hand-edit the CORE blocks.
     CORE    (§${sortedKeys(coreBlocks).join(' §')}) come from the kit's CLAUDE.core.md.
     PROJECT (§${sortedKeys(proj).join(' §')}) come from .claude/CLAUDE.project.md and are yours —
     still TEMPLATE PLACEHOLDERS here: fill them there, then run \`agent-brain-kit apply\`.
     Composed ${new Date().toISOString()} for ${name}. -->

# PROJECT CONSTITUTION — ${name}

${renderBlocks(merged)}
`;
  }

  function resolveSettings(s, abs) {
    if (!existsSync(abs)) {
      s.status = 'created'; s.merged = s.settings; s.note = `${countHooks(s.settings)} hooks wired`;
      return;
    }
    let cur;
    try { cur = JSON.parse(readFileSync(abs, 'utf8')); } catch (e) {
      s.status = 'kept'; s.warn = true;
      s.note = `NOT valid JSON, left alone — hooks are NOT wired (${e.message.split('\n')[0]})`;
      return;
    }
    const { merged, added, problem } = mergeSettings(cur, s.settings);
    if (problem) { s.status = 'kept'; s.warn = true; s.note = `${problem} — left alone, hooks NOT wired`; return; }
    if (added === 0) { s.status = 'kept'; s.note = 'hooks already wired'; return; }
    s.status = 'merged'; s.merged = merged; s.note = `+${added} hook${added === 1 ? '' : 's'}, yours untouched`;
  }
}

// ── settings merge ──────────────────────────────────────────────────────────────────────
// Adds each template hook unless the repo ALREADY runs that script — matched by the hook
// file name in the command, not the exact string, so a repo that wired guard.sh its own way
// does not get it twice. Nothing is ever removed or reordered. Unknown shapes are refused,
// not coerced: rewriting a settings file we do not understand is how you lose someone's hooks.
export function mergeSettings(existing, template) {
  if (!existing || typeof existing !== 'object' || Array.isArray(existing)) return { problem: 'settings.json is not an object' };
  const merged = structuredClone(existing);
  if (merged.hooks === undefined) merged.hooks = {};
  if (typeof merged.hooks !== 'object' || Array.isArray(merged.hooks)) return { problem: '"hooks" is not an object' };
  let added = 0;
  const script = (cmd) => (String(cmd).match(/hooks\/([\w.-]+\.sh)/) ?? [])[1] ?? String(cmd).trim();
  for (const [event, groups] of Object.entries(template.hooks ?? {})) {
    if (merged.hooks[event] === undefined) merged.hooks[event] = [];
    const cur = merged.hooks[event];
    if (!Array.isArray(cur)) return { problem: `"hooks.${event}" is not an array` };
    for (const g of groups) {
      for (const h of g.hooks ?? []) {
        const want = script(h.command);
        const present = cur.some((eg) => Array.isArray(eg?.hooks) && eg.hooks.some((eh) => script(eh?.command) === want));
        if (present) continue;
        let target = cur.find((eg) => Array.isArray(eg?.hooks) && (eg.matcher ?? '') === (g.matcher ?? ''));
        if (!target) {
          target = g.matcher === undefined ? { hooks: [] } : { matcher: g.matcher, hooks: [] };
          cur.push(target);
        }
        target.hooks.push(structuredClone(h));
        added += 1;
      }
    }
  }
  return { merged, added };
}

const countHooks = (s) => Object.values(s.hooks ?? {}).flat().reduce((n, g) => n + (g.hooks?.length ?? 0), 0);

function loopNote(p) {
  const t = readFileSync(p, 'utf8');
  return /BRAIN\.md/.test(t) && /READ FIRST|read\b[^\n]{0,40}BRAIN\.md/i.test(t)
    ? 'already yours'
    : 'already yours — but it has NO brain loop: paste BRAIN_DISCIPLINE.md into it';
}

// ── the summary ─────────────────────────────────────────────────────────────────────────
function report(steps, { dir, name, DRY, FULL, CREW, HOOKED, OPTED_OUT }) {
  const verb = (st) => (DRY ? ({ created: 'would create', kept: 'would keep', merged: 'would merge' }[st] ?? st) : st);
  const paint = (st, s) => (st === 'created' ? c.green(s) : st === 'merged' ? c.cyan(s) : c.gray(s));
  const W = DRY ? 13 : 8;
  const line = (st, rel, note, warn) => {
    const n = note ? (warn ? c.yellow(note) : c.dim(note)) : '';
    console.log(`  ${paint(st, verb(st).padEnd(W))} ${rel.padEnd(28)} ${n}`.trimEnd());
  };

  console.log('');
  console.log(`${c.bold('brain-kit setup')} ${c.gray('→')} ${dir}${DRY ? c.yellow('   (dry run — nothing written)') : ''}`);
  console.log('');

  // Agents and hooks collapse to one line when every file shares a status; a mixed group is
  // listed file by file, because "7 kept" would hide the one that was created.
  const groups = ['brain', 'claude', 'agents', 'hooks', 'settings'];
  for (const g of groups) {
    const gs = steps.filter((s) => s.group === g);
    if (!gs.length) continue;
    const uniform = gs.every((s) => s.status === gs[0].status && !s.note);
    if ((g === 'agents' || g === 'hooks') && uniform && gs.length > 1) {
      const names = gs.map((s) => basename(s.rel).replace(/\.(md|sh)$/, '')).join(', ');
      line(gs[0].status, `.claude/${g}/`, `${gs.length} ${g}: ${names}`);
    } else {
      for (const s of gs) line(s.status, s.rel, s.note, s.warn);
    }
  }
  const why = (flag) => (OPTED_OUT ? 'opted out (.claude/.no-crew-hooks)' : `not installed (${flag})`);
  if (!CREW) line('skipped', '.claude/agents/', why('--no-crew'));
  if (!HOOKED) line('skipped', '.claude/hooks/', why('--no-hooks'));

  const count = (st) => steps.filter((s) => s.status === st).length;
  console.log('');
  console.log(`  ${c.green(count('created') + ' ' + (DRY ? 'to create' : 'created'))} · ${c.gray(count('kept') + ' kept')} · ${c.cyan(count('merged') + ' merged')}`);

  if (DRY) { console.log(`\n  Run again without --dry-run to apply.\n`); return; }
  const rel = relative(process.cwd(), dir);
  const here = rel === '' ? 'this repo' : rel;
  let n = 0;
  console.log('');
  console.log(c.bold('Next:'));
  console.log(`  ${++n}. Open Claude Code in ${here} and ask it to ${c.cyan('"fill BRAIN.md §1–§2 from the codebase"')}.`);
  if (FULL) console.log(`  ${++n}. Fill the placeholders in .claude/CLAUDE.project.md, then: ${c.cyan(`npx agent-brain-kit apply ${name} --fleet-root ..`)}`);
  console.log(`  ${++n}. Check the brain's health any time: ${c.cyan(`npx agent-brain-kit doctor${rel === '' ? '' : ' ' + (/\s/.test(rel) ? `"${rel}"` : rel)}`)}`);
  console.log('');
}
