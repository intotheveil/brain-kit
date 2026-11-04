#!/usr/bin/env node
// test-kit.mjs — unit tests for kit.mjs.
//
// WHY THIS IS DEPENDENCY-FREE. This repo has no application stack and no package.json by
// design (§2), which is precisely why kit.mjs had no test: the SubagentStop gate here runs only
// the staged-secret scan, so kit changes were verified by verify-kit.sh alone — and verify-kit
// checks the FLEET's state, not the composer's behaviour. Adding vitest to carry eight
// assertions would change what this repo is. node:assert is already here.
//
// Every case runs kit.mjs as a CHILD PROCESS against fixtures in a throwaway directory, so it
// tests the real CLI surface — argv parsing, exit codes, refusals — not an imported function.
//
//   node test/test-kit.mjs
//
// Exit 0 = all passed. Exit 1 = a failure. Never silent.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, basename, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const KIT_MJS = join(KIT, '..', 'kit.mjs'); // kit.mjs is at the repo root here

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    console.log(`        ${err.message.split('\n').slice(0, 4).join('\n        ')}`);
    failed += 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/** Run kit.mjs; never throws. Returns {code, out} with stdout+stderr merged. */
function kit(args, root) {
  try {
    // No --fleet-root when there are no args: the usage case must see a genuinely empty
    // argv, not a lone flag.
    const argv = args.length === 0 ? [KIT_MJS] : [KIT_MJS, ...args, '--fleet-root', root];
    const out = execFileSync(process.execPath, argv, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

/** A throwaway fleet root holding one repo. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'kit-test-'));
  mkdirSync(join(root, 'demo', '.claude'), { recursive: true });
  return root;
}

/** Fill every angle-bracket placeholder so `apply` will proceed. */
function fill(root) {
  const p = join(root, 'demo', '.claude', 'CLAUDE.project.md');
  const filled = readFileSync(p, 'utf8')
    .replace(/PLACEHOLDER/g, 'filled')
    .replace(/<[^>!/][^>]{2,}>/g, 'filled');
  writeFileSync(p, filled, 'utf8');
}

const roots = [];
function withFixture(fn) {
  const root = fixture();
  roots.push(root);
  fn(root);
}

console.log('kit.mjs — unit tests');
console.log('--------------------------------------------------------------');

check('init proposes CLAUDE.project.md', () => {
  withFixture((root) => {
    const r = kit(['init', 'demo'], root);
    assert(r.code === 0, `expected exit 0, got ${r.code}: ${r.out}`);
    assert(existsSync(join(root, 'demo', '.claude', 'CLAUDE.project.md')), 'project half not written');
  });
});

check('init does NOT write CLAUDE.md (documented, and easy to regress)', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    assert(!existsSync(join(root, 'demo', '.claude', 'CLAUDE.md')), 'init wrote CLAUDE.md');
  });
});

check('apply REFUSES while placeholders remain, and writes nothing', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    const r = kit(['apply', 'demo'], root);
    assert(r.code !== 0, 'apply should fail on placeholders');
    assert(/REFUS/i.test(r.out), `expected a refusal, got: ${r.out}`);
    assert(!existsSync(join(root, 'demo', '.claude', 'CLAUDE.md')), 'refusal still wrote CLAUDE.md');
  });
});

check('apply composes CORE + PROJECT once filled', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    fill(root);
    const r = kit(['apply', 'demo'], root);
    assert(r.code === 0, `apply failed: ${r.out}`);
    const md = readFileSync(join(root, 'demo', '.claude', 'CLAUDE.md'), 'utf8');
    const core = (md.match(/KIT:CORE:BEGIN/g) ?? []).length;
    const proj = (md.match(/KIT:PROJECT:BEGIN/g) ?? []).length;
    assert(core >= 6, `expected >=6 CORE blocks, got ${core}`);
    assert(proj >= 3, `expected >=3 PROJECT blocks, got ${proj}`);
    assert(md.includes('do not hand-edit'), 'banner missing its warning');
    assert(md.includes('demo'), 'composed file not titled for the repo');
  });
});

check('check reports canonical after a clean apply', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    fill(root);
    kit(['apply', 'demo'], root);
    const r = kit(['check', 'demo'], root);
    assert(/canonical/i.test(r.out), `expected canonical, got: ${r.out}`);
  });
});

// ADVERSARIAL. A checker that cannot fail is decoration; this is the case that matters.
check('check DETECTS an edited CORE block', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    fill(root);
    kit(['apply', 'demo'], root);
    const p = join(root, 'demo', '.claude', 'CLAUDE.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace('READ FIRST', 'READ LATER'), 'utf8');
    const r = kit(['check', 'demo'], root);
    assert(!/core is canonical/i.test(r.out), `tampering not detected: ${r.out}`);
  });
});

check('a PROJECT block reusing a CORE number is REFUSED, not silently merged', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    fill(root);
    const p = join(root, 'demo', '.claude', 'CLAUDE.project.md');
    // §0 is a CORE section. Claiming it from the project half is data loss in whichever
    // direction the spread happens to resolve, so the composer must refuse.
    writeFileSync(
      p,
      readFileSync(p, 'utf8') + '\n<!-- KIT:PROJECT:BEGIN §0 -->\nhijack\n<!-- KIT:PROJECT:END §0 -->\n',
      'utf8'
    );
    const r = kit(['apply', 'demo'], root);
    assert(r.code !== 0, `expected refusal, got exit 0: ${r.out}`);
  });
});

check('an unknown repo is INCONCLUSIVE (exit 2), never a silent pass', () => {
  withFixture((root) => {
    const r = kit(['check', 'nosuchrepo'], root);
    assert(r.code === 2, `expected exit 2, got ${r.code}: ${r.out}`);
    assert(/INCONCLUSIVE/i.test(r.out), `expected INCONCLUSIVE, got: ${r.out}`);
  });
});

check('no command / no repo prints usage and exits 2', () => {
  withFixture((root) => {
    const r = kit([], root);
    assert(r.code === 2, `expected exit 2, got ${r.code}`);
    assert(/usage/i.test(r.out), `expected usage, got: ${r.out}`);
  });
});

check('a CRLF CLAUDE.project.md still composes (Windows autocrlf checkout)', () => {
  withFixture((root) => {
    kit(['init', 'demo'], root);
    fill(root);
    const p = join(root, 'demo', '.claude', 'CLAUDE.project.md');
    writeFileSync(p, readFileSync(p, 'utf8').replace(/\r?\n/g, '\r\n'), 'utf8');
    const r = kit(['apply', 'demo'], root);
    assert(r.code === 0, `CRLF project half did not compose: ${r.out}`);
  });
});

check('init/apply REFUSE a git worktree (its .git is a file)', () => {
  withFixture((root) => {
    writeFileSync(join(root, 'demo', '.git'), 'gitdir: /somewhere/else\n', 'utf8');
    const r = kit(['init', 'demo'], root);
    assert(r.code === 1 && /WORKTREE/.test(r.out), `expected a worktree refusal, got ${r.code}: ${r.out}`);
    assert(!existsSync(join(root, 'demo', '.claude', 'CLAUDE.project.md')), 'refusal still wrote');
  });
});

// ── setup ─────────────────────────────────────────────────────────────────────────────────
// Like the cases above, these run the real CLI as a child process. Temp dirs come from
// os.tmpdir() — NOT `mktemp -d`, whose POSIX path a Windows node binary cannot resolve.

/** Run `kit.mjs <args>` with no --fleet-root (setup/doctor take a directory). */
function cli(args, env = {}) {
  try {
    const out = execFileSync(process.execPath, [KIT_MJS, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, NO_COLOR: '1', ...env }
    });
    return { code: 0, out };
  } catch (err) {
    return { code: err.status ?? 1, out: `${err.stdout ?? ''}${err.stderr ?? ''}` };
  }
}

function tempDir(prefix = 'kit-setup-') {
  const d = mkdtempSync(join(tmpdir(), prefix));
  roots.push(d);
  return d;
}

/** Every file under dir (relative path → content), so "changed nothing" can be asserted exactly. */
function snapshot(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out[relative(dir, p).split(sep).join('/')] = readFileSync(p, 'utf8');
    }
  };
  walk(dir);
  return out;
}

const AGENTS = ['builder', 'explore', 'planner', 'qa', 'researcher', 'reviewer', 'test-writer'];

check('setup installs brain, CLAUDE.md, crew, hooks and settings into a fresh dir', () => {
  const d = tempDir();
  const r = cli(['setup', d]);
  assert(r.code === 0, `setup failed: ${r.out}`);
  assert(existsSync(join(d, 'BRAIN.md')), 'BRAIN.md not created');
  assert(readFileSync(join(d, 'BRAIN.md'), 'utf8').includes(`BRAIN — ${basename(d)}`), 'BRAIN.md not titled for the repo');
  const md = readFileSync(join(d, '.claude', 'CLAUDE.md'), 'utf8');
  assert(/READ FIRST/.test(md) && /WRITE BEFORE ENDING/.test(md), 'CLAUDE.md lacks the brain loop');
  for (const a of AGENTS) assert(existsSync(join(d, '.claude', 'agents', `${a}.md`)), `agent ${a} missing`);
  for (const h of ['_json.sh', 'guard.sh', 'subagent-gate.sh', 'brain-check.sh', 'secret-scan.sh', 'format.sh', 'notify.sh']) {
    assert(existsSync(join(d, '.claude', 'hooks', h)), `hook ${h} missing`);
  }
  const s = JSON.parse(readFileSync(join(d, '.claude', 'settings.json'), 'utf8'));
  for (const ev of ['PreToolUse', 'PostToolUse', 'SubagentStop', 'Stop']) assert(Array.isArray(s.hooks?.[ev]), `settings lacks ${ev}`);
  assert(/Next:/.test(r.out) && /BRAIN\.md §1–§2/.test(r.out), `summary lacks the next step: ${r.out}`);
});

check('setup is idempotent: a second run keeps everything and changes nothing', () => {
  const d = tempDir();
  cli(['setup', d]);
  const before = snapshot(d);
  const r = cli(['setup', d]);
  assert(r.code === 0, `second run failed: ${r.out}`);
  assert(/\b0 created\b/.test(r.out), `second run created something: ${r.out}`);
  assert(/hooks already wired/.test(r.out), `settings not reported as already wired: ${r.out}`);
  assert(JSON.stringify(snapshot(d)) === JSON.stringify(before), 'second run changed a file');
});

check('setup NEVER overwrites an existing file', () => {
  const d = tempDir();
  writeFileSync(join(d, 'BRAIN.md'), 'my brain, hands off\n', 'utf8');
  mkdirSync(join(d, '.claude', 'hooks'), { recursive: true });
  writeFileSync(join(d, '.claude', 'hooks', 'guard.sh'), '# my own guard\n', 'utf8');
  const r = cli(['setup', d]);
  assert(r.code === 0, `setup failed: ${r.out}`);
  assert(readFileSync(join(d, 'BRAIN.md'), 'utf8') === 'my brain, hands off\n', 'BRAIN.md was overwritten');
  assert(readFileSync(join(d, '.claude', 'hooks', 'guard.sh'), 'utf8') === '# my own guard\n', 'a customised hook was overwritten');
  assert(/kept\s+\.claude\/hooks\/guard\.sh\s+differs from the kit/.test(r.out), `customised hook not reported: ${r.out}`);
});

check('setup MERGES into an existing settings.json — keeps yours, adds once, backs up', () => {
  const d = tempDir();
  mkdirSync(join(d, '.claude'), { recursive: true });
  const mine = {
    permissions: { allow: ['Bash(npm test)'] },
    hooks: {
      PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'bash .claude/hooks/guard.sh' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }]
    }
  };
  writeFileSync(join(d, '.claude', 'settings.json'), JSON.stringify(mine), 'utf8');
  const r = cli(['setup', d]);
  assert(r.code === 0 && /merged\s+\.claude\/settings\.json/.test(r.out), `expected a merge: ${r.out}`);
  const s = JSON.parse(readFileSync(join(d, '.claude', 'settings.json'), 'utf8'));
  assert(s.permissions?.allow?.[0] === 'Bash(npm test)', 'permissions were lost');
  const cmds = (ev) => (s.hooks[ev] ?? []).flatMap((g) => g.hooks.map((h) => h.command));
  assert(cmds('Stop').includes('echo mine'), 'the repo\'s own Stop hook was lost');
  assert(cmds('PreToolUse').filter((c) => c.includes('guard.sh')).length === 1, `guard.sh wired twice: ${cmds('PreToolUse')}`);
  assert(cmds('SubagentStop').some((c) => c.includes('subagent-gate.sh')), 'gate not wired');
  assert(cmds('Stop').some((c) => c.includes('brain-check.sh')), 'brain-check not wired');
  assert(existsSync(join(d, '.claude', 'settings.json.pre-brain-kit')), 'no backup of the original settings');
  const again = cli(['setup', d]);
  assert(/hooks already wired/.test(again.out), `second merge was not a no-op: ${again.out}`);
});

check('setup leaves an INVALID settings.json alone and says hooks are not wired', () => {
  const d = tempDir();
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', 'settings.json'), '{ not json', 'utf8');
  const r = cli(['setup', d]);
  assert(readFileSync(join(d, '.claude', 'settings.json'), 'utf8') === '{ not json', 'invalid settings rewritten');
  assert(/NOT valid JSON/.test(r.out), `no warning: ${r.out}`);
});

check('setup --dry-run writes NOTHING', () => {
  const d = tempDir();
  const r = cli(['setup', d, '--dry-run']);
  assert(r.code === 0, `dry run failed: ${r.out}`);
  assert(/would create/.test(r.out), `dry run printed no plan: ${r.out}`);
  assert(readdirSync(d).length === 0, `dry run wrote: ${readdirSync(d).join(', ')}`);
});

check('setup --no-crew installs no agents (hooks still go in)', () => {
  const d = tempDir();
  const r = cli(['setup', d, '--no-crew']);
  assert(r.code === 0, `setup failed: ${r.out}`);
  assert(!existsSync(join(d, '.claude', 'agents')), '--no-crew still wrote agents');
  assert(existsSync(join(d, '.claude', 'hooks', 'guard.sh')), 'hooks missing');
  assert(!/## The crew/.test(readFileSync(join(d, '.claude', 'CLAUDE.md'), 'utf8')), 'CLAUDE.md describes a crew that was not installed');
});

check('setup honours .claude/.no-crew-hooks (a written opt-out)', () => {
  const d = tempDir();
  mkdirSync(join(d, '.claude'), { recursive: true });
  writeFileSync(join(d, '.claude', '.no-crew-hooks'), 'no thanks\n', 'utf8');
  cli(['setup', d]);
  assert(!existsSync(join(d, '.claude', 'agents')) && !existsSync(join(d, '.claude', 'hooks')), 'opt-out ignored');
  assert(existsSync(join(d, 'BRAIN.md')), 'the brain itself should still be installed');
});

// The first smoke run of setup passed an unset shell variable, and resolve('') is the cwd: it
// installed the crew into this kit's own checkout. An empty argument must be refused.
check('setup REFUSES an empty directory argument (an unset variable is not "here")', () => {
  const r = cli(['setup', '']);
  assert(r.code === 2 && /EMPTY/.test(r.out), `expected exit 2 + EMPTY, got ${r.code}: ${r.out}`);
});

check('setup --full composes the whole constitution and writes the project half', () => {
  const d = tempDir();
  const r = cli(['setup', d, '--full']);
  assert(r.code === 0, `setup --full failed: ${r.out}`);
  const md = readFileSync(join(d, '.claude', 'CLAUDE.md'), 'utf8');
  assert((md.match(/KIT:CORE:BEGIN/g) ?? []).length === 8, 'expected 8 CORE blocks');
  assert((md.match(/KIT:PROJECT:BEGIN/g) ?? []).length === 4, 'expected 4 PROJECT blocks');
  assert(existsSync(join(d, '.claude', 'CLAUDE.project.md')), 'project half not written');
});

// ── doctor ────────────────────────────────────────────────────────────────────────────────
const EXAMPLE = join(KIT, '..', 'examples', 'BRAIN.example.md');
const doctorJson = (d) => {
  const r = cli(['doctor', d, '--json']);
  return { code: r.code, j: JSON.parse(r.out) };
};

check('doctor scores the filled-in example brain as healthy (>= 70, exit 0)', () => {
  const d = tempDir('kit-doctor-');
  writeFileSync(join(d, 'BRAIN.md'), readFileSync(EXAMPLE, 'utf8'), 'utf8');
  const { code, j } = doctorJson(d);
  assert(j.score >= 70 && code === 0, `example scored ${j.score} (exit ${code}): ${JSON.stringify(j.checks.filter((c) => c.status !== 'pass'))}`);
  for (const id of ['sections', 'filled', 'gotchas', 'changelog', 'left-off', 'outstanding']) {
    assert(j.checks.find((c) => c.id === id)?.status === 'pass', `${id} did not pass on the example`);
  }
});

check('doctor scores a template-only brain LOW (< 70, exit 1) even with the loop installed', () => {
  const d = tempDir('kit-doctor-');
  cli(['setup', d]);
  const { code, j } = doctorJson(d);
  assert(j.score < 70 && code === 1, `template brain scored ${j.score} (exit ${code})`);
  assert(j.checks.find((c) => c.id === 'gotchas').status === 'fail', 'template §5 counted as a real gotcha');
  assert(j.checks.find((c) => c.id === 'filled').status === 'fail', 'template §1/§2 counted as filled');
  assert(j.checks.find((c) => c.id === 'loop').status === 'pass', 'setup\'s CLAUDE.md loop not recognised');
});

check('doctor parses a CRLF brain exactly like the LF one', () => {
  const lf = tempDir('kit-doctor-');
  const crlf = tempDir('kit-doctor-');
  const text = readFileSync(EXAMPLE, 'utf8').replace(/\r\n/g, '\n');
  writeFileSync(join(lf, 'BRAIN.md'), text, 'utf8');
  writeFileSync(join(crlf, 'BRAIN.md'), text.replace(/\n/g, '\r\n'), 'utf8');
  const a = doctorJson(lf).j;
  const b = doctorJson(crlf).j;
  const view = (j) => j.checks.filter((c) => c.id !== 'size' && c.id !== 'brain-exists').map((c) => `${c.id}:${c.status}:${c.points}`).join(' ');
  assert(view(a) === view(b), `CRLF changed the verdict:\n LF   ${view(a)}\n CRLF ${view(b)}`);
});

check('doctor exits 1 when there is no BRAIN.md', () => {
  const d = tempDir('kit-doctor-');
  const r = cli(['doctor', d]);
  assert(r.code === 1, `expected exit 1, got ${r.code}: ${r.out}`);
  assert(/no BRAIN\.md/.test(r.out), `missing-brain not named: ${r.out}`);
});

// ADVERSARIAL: the §5 gotcha this kit was built around. Counting rows says "fine"; counting
// cells per row is what catches it.
check('doctor CATCHES a literal | that splits an outstanding-table row', () => {
  const d = tempDir('kit-doctor-');
  const text = readFileSync(EXAMPLE, 'utf8').replace(/\r\n/g, '\n')
    .replace('| E2 | 🟡 | gap |', '| E2 | 🟡 | gap | `a | b` shape |');
  writeFileSync(join(d, 'BRAIN.md'), text, 'utf8');
  const c = doctorJson(d).j.checks.find((x) => x.id === 'outstanding');
  assert(c.status === 'fail' && /\\\|/.test(c.fix), `split row not caught: ${JSON.stringify(c)}`);
});

check('doctor flags a missing "left off" pointer on the newest entry', () => {
  const d = tempDir('kit-doctor-');
  const text = readFileSync(EXAMPLE, 'utf8').replace(/\r\n/g, '\n').replace(/\*\*Left off:\*\*[^\n]*\n/, '\n');
  writeFileSync(join(d, 'BRAIN.md'), text, 'utf8');
  const c = doctorJson(d).j.checks.find((x) => x.id === 'left-off');
  assert(c.status === 'fail', `missing pointer not flagged: ${JSON.stringify(c)}`);
});

check('doctor prints no ANSI colour when NO_COLOR is set or output is piped', () => {
  const d = tempDir('kit-doctor-');
  writeFileSync(join(d, 'BRAIN.md'), readFileSync(EXAMPLE, 'utf8'), 'utf8');
  const r = cli(['doctor', d], { NO_COLOR: '1' });
  assert(!/\x1b\[/.test(r.out), 'escape codes in piped output');
  assert(/\/100/.test(r.out), `no score line: ${r.out}`);
});

for (const r of roots) rmSync(r, { recursive: true, force: true });

console.log('--------------------------------------------------------------');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
