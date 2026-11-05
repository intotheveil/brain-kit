// doctor.mjs — `agent-brain-kit doctor [dir] [--json]`: grade a repo's brain health.
//
// Prints a score out of 100 with one line per check and a one-line fix for every miss.
// Exit 0 if the score is >= 70, else 1 (2 if the directory cannot be read at all).
//
// WHAT IT GRADES IS THE DISCIPLINE, NOT THE PROSE. A brain decays in predictable ways: the
// "Last updated" line stops moving, §5 never gets its first gotcha, the changelog stops saying
// where the last session left off, and the CLAUDE.md that was supposed to enforce the loop
// never mentioned it. Each of those is mechanically detectable, so each is a check.
//
// TOLERANT PARSING, deliberately. Brains are hand-written: headings drift ("## 5. Gotchas",
// "## §5 GOTCHAS", "### 5) gotchas"), files arrive CRLF from Windows checkouts, and `#` lines
// inside code fences are not headings. A strict parser would report a healthy brain as broken
// — and a health check that cries wolf is ignored, which is worse than no check at all.

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { c } from './term.mjs';
import { diagnoseFiles, PASS_MARK, CREW } from './diagnose.mjs';

export async function run(args, _KIT) {
  const json = args.includes('--json');
  const unknown = args.filter((a) => a.startsWith('--') && a !== '--json');
  if (unknown.length) { console.error(`doctor: unknown flag ${unknown.join(' ')}\nusage: agent-brain-kit doctor [dir] [--json]`); return 2; }
  const positional = args.filter((a) => !a.startsWith('--'));
  if (positional.length === 1 && positional[0].trim() === '') {
    console.error('doctor: the directory argument is EMPTY (an unset variable?). Omit it to mean the current directory.');
    return 2;
  }
  const dir = resolve(positional[0] ?? process.cwd());
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    if (json) console.log(JSON.stringify({ dir, error: 'no such directory' }));
    else console.error(`INCONCLUSIVE: no directory at ${dir}`);
    return 2;
  }

  const result = diagnose(dir);
  if (json) console.log(JSON.stringify(result, null, 2));
  else render(result);
  return result.pass ? 0 : 1;
}

/** Read a repo's brain, loop files and crew from disk, then grade them (lib/diagnose.mjs). */
export function diagnose(dir) {
  const brainPath = join(dir, 'BRAIN.md');
  const brain = existsSync(brainPath) ? readFileSync(brainPath, 'utf8') : null;
  const loopFiles = ['.claude/CLAUDE.md', 'CLAUDE.md', 'AGENTS.md']
    .filter((f) => existsSync(join(dir, f)))
    .map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
  const agentsDir = join(dir, '.claude', 'agents');
  const agents = existsSync(agentsDir) ? CREW.filter((a) => existsSync(join(agentsDir, `${a}.md`))) : [];
  return diagnoseFiles({ brain, loopFiles, agents }, { dir });
}

// ── rendering ─────────────────────────────────────────────────────────────────────────────
function render(r) {
  const icon = { pass: c.green('✔'), fail: c.red('✖'), warn: c.yellow('!'), info: c.blue('·') };
  console.log('');
  console.log(`${c.bold('brain doctor')} ${c.gray('→')} ${r.dir}`);
  console.log('');
  // With no brain, eight checks fail for the same single reason; print that reason once.
  const blind = r.checks.filter((ch) => / — no brain to check$/.test(ch.message));
  const shown = r.checks.filter((ch) => !blind.includes(ch));
  if (blind.length) {
    const at = shown.findIndex((ch) => ch.id === 'brain-exists') + 1;
    shown.splice(at, 0, { status: 'fail', points: 0, max: blind.reduce((s, ch) => s + ch.max, 0), message: `${blind.length} brain checks skipped — there is nothing to grade` });
  }
  for (const ch of shown) {
    const pts = ch.max ? c.gray(`${String(ch.points).padStart(2)}/${String(ch.max).padEnd(2)}`) : c.gray('     ');
    const msg = ch.status === 'fail' ? ch.message : ch.status === 'info' ? c.dim(ch.message) : ch.message;
    console.log(`  ${icon[ch.status]} ${pts}  ${msg}`);
    if (ch.fix) console.log(`           ${c.dim('→ ' + ch.fix)}`);
  }
  const width = 24;
  const filled = Math.round((r.score / r.max) * width);
  const tint = r.score >= 90 ? c.green : r.score >= PASS_MARK ? c.cyan : r.score >= 40 ? c.yellow : c.red;
  const label = r.score >= 90 ? 'excellent' : r.score >= PASS_MARK ? 'healthy' : r.score >= 40 ? 'needs work' : 'critical';
  console.log('');
  console.log(`  ${tint('█'.repeat(filled))}${c.gray('░'.repeat(width - filled))}  ${c.bold(tint(`${r.score}/${r.max}`))}  ${tint(label)}${r.pass ? '' : c.gray(`  (pass mark ${PASS_MARK})`)}`);
  console.log('');
}
