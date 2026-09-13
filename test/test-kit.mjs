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
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
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

for (const r of roots) rmSync(r, { recursive: true, force: true });

console.log('--------------------------------------------------------------');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
