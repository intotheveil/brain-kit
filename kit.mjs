#!/usr/bin/env node
// kit.mjs — compose a fleet repo's .claude/CLAUDE.md from two halves.
//
//   CORE    (§0 §3 §4 §5 §6 §7 §9 §10)  — owned by the kit, identical fleet-wide, synced.
//   PROJECT (§1 §2 §8 §11)              — owned by the repo, NEVER written by sync.
//
// The halves are marker-delimited, so sync can replace a CORE block in place without ever
// reading or touching a PROJECT block. That is the whole point: the previous attempt to keep
// a dozen repos aligned was prose instructions ("install the full build-kit"), which produced
// three different guard.sh files and eight repos whose agents cited a section that did not
// exist in them. Prose does not converge; a generator does.
//
// Commands:
//   node kit.mjs init    <repo>   propose .claude/CLAUDE.project.md (never writes CLAUDE.md)
//   node kit.mjs compose <repo>   print the composed CLAUDE.md to stdout
//   node kit.mjs apply   <repo>   write .claude/CLAUDE.md (backs up the previous file)
//   node kit.mjs check   <repo>   are this repo's CORE blocks identical to canonical?
//
// --fleet-root DIR overrides the default (the parent of this kit checkout, i.e. the
// directory your repos are siblings in).
// Exit codes: 0 ok · 1 real failure · 2 inconclusive (could not check — never a silent pass).

import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const cmd = argv[0];
const repo = argv[1];
const rootFlag = argv.indexOf('--fleet-root');

const die = (msg, code = 1) => { console.error(msg); process.exit(code); };
if (!cmd || !repo || repo.startsWith('--')) {
  die('usage: kit.mjs <init|compose|apply|check> <repo> [--fleet-root DIR]', 2);
}

// WHERE YOUR REPOS LIVE. An explicit --fleet-root always wins. Otherwise TRY, in order, the
// parent of this kit checkout (repos as siblings of brain-kit) and then the current working
// directory (what `npx brain-kit` needs, since the package then sits under node_modules and
// its parent is meaningless). Resolving a root from ONE hardcoded relative path is a bug this
// kit has watched happen: a test harness pinned `homedir()/projects`, was wrong on every other
// machine, and the failure looked like a broken tool rather than a wrong assumption. So: try
// the candidates, and if none holds the repo, SAY WHAT WAS TRIED instead of naming one path.
const candidates = rootFlag > -1
  ? [resolve(argv[rootFlag + 1])]
  : [resolve(KIT, '..'), resolve(process.cwd())];

const FLEET = candidates.find((c) => existsSync(join(c, repo)));
if (!FLEET) {
  die(
    `INCONCLUSIVE: no repo "${repo}" under any candidate root:\n` +
      candidates.map((c) => `  - ${c}`).join('\n') +
      `\nPass --fleet-root DIR to say where your repos live.`,
    2
  );
}

const repoDir = join(FLEET, repo);
const claudeDir = join(repoDir, '.claude');
const claudeMd = join(claudeDir, 'CLAUDE.md');
const projectMd = join(claudeDir, 'CLAUDE.project.md');

// ── block parsing ────────────────────────────────────────────────────────────────────────
// A block is  <!-- KIT:<KIND>:BEGIN §N -->  ...  <!-- KIT:<KIND>:END §N -->
// Returns Map<number, {kind, body}>. Body excludes the markers.
function parseBlocks(text) {
  const out = new Map();
  const re = /<!--\s*KIT:(CORE|PROJECT):BEGIN\s*§(\d+)\s*-->\n([\s\S]*?)<!--\s*KIT:\1:END\s*§\2\s*-->/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.set(Number(m[2]), { kind: m[1], body: m[3].replace(/\s+$/, '') });
  }
  return out;
}

const readIf = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);
const coreText = readIf(join(KIT, 'CLAUDE.core.md'));
if (!coreText) die(`INCONCLUSIVE: canonical core missing at ${join(KIT, 'CLAUDE.core.md')}`, 2);
const coreBlocks = parseBlocks(coreText);
if (coreBlocks.size === 0) die('INCONCLUSIVE: canonical core parsed to zero blocks', 2);

// ── init: propose a project half, losing nothing ─────────────────────────────────────────
// Extracts §1/§2/§8/§11 from the repo's existing CLAUDE.md where the heading is unambiguous,
// falls back to the template placeholder where it is not, and ALWAYS preserves the original
// verbatim as CLAUDE.md.pre-kit. It never guesses silently: every section reports its source.
// FENCE-AWARE. A '#' at the start of a line inside a ``` block is a shell comment, not a
// heading. The first version did not know that and truncated one repo's §8 Commands at a
// line reading "# Whole appliance (Docker Compose)" — 3 lines carried out of 30, silently.
// §8 is the
// section the SubagentStop gate EXECUTES, so a quiet truncation there is the worst possible
// place for this bug. Any repo whose command block carries shell comments would have hit it.
function sectionFrom(text, patterns) {
  if (!text) return null;
  const lines = text.split('\n');
  for (const pat of patterns) {
    const start = lines.findIndex((l) => pat.test(l));
    if (start === -1) continue;
    let end = lines.length;
    let inFence = false;
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\s*(```|~~~)/.test(lines[i])) { inFence = !inFence; continue; }
      if (!inFence && /^#{1,2} /.test(lines[i])) { end = i; break; }
    }
    return lines.slice(start, end).join('\n').replace(/\s+$/, '');
  }
  return null;
}

if (cmd === 'init') {
  const tpl = readIf(join(KIT, 'templates', 'CLAUDE.project.template.md'));
  if (!tpl) die('INCONCLUSIVE: CLAUDE.project.template.md missing', 2);
  const tplBlocks = parseBlocks(tpl);
  const existing = readIf(claudeMd);

  const WANT = [
    [1, [/^##\s*1\.\s/], 'What this project is'],
    [2, [/^##\s*2\.\s/], 'Stack'],
    [8, [/^##\s*8\.\s/], 'Commands'],
    [11, [/^##\s*11\.\s/, /^##\s*Product-specific reminders/i], 'Project-specific reminders'],
  ];

  const parts = [];
  const report = [];
  for (const [n, pats, label] of WANT) {
    const found = sectionFrom(existing, pats);
    let body;
    if (found) {
      // Renumber the heading into the kit's slot, keeping the ORIGINAL TITLE TEXT verbatim.
      // The first version also stripped the matched title word, so
      //   "## Product-specific reminders (from BRAIN.md — the high-frequency ones)"
      // became "## 11. (from BRAIN.md — the high-frequency ones)" — a section with no name.
      // Titles are contractual (builder.md binds §2 and §8 by name), so only the NUMBER may
      // be rewritten here; everything after it is the repo's and is carried untouched.
      const nl = found.indexOf('\n');
      const head = nl === -1 ? found : found.slice(0, nl);
      const rest = nl === -1 ? '' : found.slice(nl);
      const title = head.replace(/^#{1,6}\s*/, '').replace(/^\d+\.\s*/, '').trim();
      body = `## ${n}. ${title}${rest}`;
      report.push(`  §${n.toString().padEnd(2)} CARRIED OVER from this repo (${found.split('\n').length} lines) — ${label}`);
    } else {
      body = tplBlocks.get(n)?.body ?? `## ${n}. ${label}\n\n<TODO>`;
      report.push(`  §${n.toString().padEnd(2)} PLACEHOLDER — this repo had no §${n}; fill it before apply`);
    }
    parts.push(`<!-- KIT:PROJECT:BEGIN §${n} -->\n${body}\n<!-- KIT:PROJECT:END §${n} -->`);
  }

  const header = `<!-- KIT:PROJECT v1 for ${repo} — generated by kit.mjs init on ${new Date().toISOString()}.
     Sections here are OWNED BY THIS REPO and are never overwritten by kit sync.
     Anything marked PLACEHOLDER must be filled before this repo is composed.
     The pre-kit CLAUDE.md is preserved verbatim at .claude/CLAUDE.md.pre-kit. -->\n`;

  if (existing && !existsSync(claudeMd + '.pre-kit')) {
    copyFileSync(claudeMd, claudeMd + '.pre-kit');
    report.push(`  original preserved → .claude/CLAUDE.md.pre-kit`);
  }
  mkdirSync(claudeDir, { recursive: true });
  writeFileSync(projectMd, header + '\n' + parts.join('\n\n') + '\n', 'utf8');
  console.log(`init ${repo} → .claude/CLAUDE.project.md`);
  report.forEach((r) => console.log(r));
  console.log(`  (CLAUDE.md itself was NOT modified)`);
  process.exit(0);
}

// ── compose / apply ──────────────────────────────────────────────────────────────────────
if (cmd === 'compose' || cmd === 'apply') {
  const projText = readIf(projectMd);
  if (!projText) die(`INCONCLUSIVE: ${repo} has no .claude/CLAUDE.project.md — run: kit.mjs init ${repo}`, 2);
  const projBlocks = parseBlocks(projText);
  if (projBlocks.size === 0) die(`INCONCLUSIVE: ${repo}'s CLAUDE.project.md parsed to zero blocks`, 2);

  // Unfilled-placeholder detection. Two independent signals, because the first version of
  // this check hand-listed a few placeholder strings, caught §1, and silently MISSED §2 and
  // §8 — and §8 is the one the SubagentStop gate actually executes. A check that passes
  // partially while reporting confidently is the exact failure this kit exists to end.
  //   (a) the block is still byte-identical to the template's block for that section
  //   (b) the block still contains an angle-bracket placeholder token (<...>, not an HTML tag)
  const tplText = readIf(join(KIT, 'templates', 'CLAUDE.project.template.md'));
  const tplBlocks2 = tplText ? parseBlocks(tplText) : new Map();
  const PLACEHOLDER = /<[^>!/][^>]{2,}>/;
  const unfilled = [...projBlocks.entries()].filter(([n, b]) => {
    const norm = (s) => s.replace(/\r/g, '').trim();
    if (tplBlocks2.has(n) && norm(tplBlocks2.get(n).body) === norm(b.body)) return true;
    return PLACEHOLDER.test(b.body);
  });
  if (unfilled.length && cmd === 'apply') {
    die(`REFUSING to apply: ${repo} has unfilled placeholders in §${unfilled.map(([n]) => n).join(' §')}.\n` +
        `Fill them in .claude/CLAUDE.project.md first.\n` +
        `§8 especially: the SubagentStop gate RUNS what it names, so a placeholder command fails every agent here.`, 1);
  }
  if (unfilled.length && cmd === 'compose') {
    console.error(`# WARNING: unfilled placeholders in §${unfilled.map(([n]) => n).join(' §')}`);
  }

  // ── KEEPS: a repo may OVERRIDE a core section, but only by declaring it ────────────────
  // CLAUDE.core.md §9 permits deviating from §4/§7/§9 with a dated DECISIONS.md entry. This
  // is that permission made machine-readable. A repo declares, in CLAUDE.project.md:
  //     <!-- KIT:KEEPS 4,7,9 — ADR: DECISIONS.md 2026-07-17 appliance stack / continuous build -->
  // and then supplies its own PROJECT block for each kept number. Those numbers stop being
  // collisions and become declared overrides.
  //
  // The declaration is verified, not trusted: a kept number with no PROJECT block, or with no
  // DECISIONS.md to point at, is refused. Otherwise `keeps` would be a way to silently drop a
  // core rule — which is exactly the thing this kit exists to end. A fork you wrote down is a
  // decision; a fork you didn't is the three guard.sh variants we started from.
  const keepsMatch = projText.match(/<!--\s*KIT:KEEPS\s+([0-9,\s]+?)\s*(?:—|--|-)\s*ADR:\s*([^>]*?)\s*-->/);
  const keeps = new Set();
  let keepsAdr = '';
  if (keepsMatch) {
    keepsMatch[1].split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)).forEach((n) => keeps.add(n));
    keepsAdr = keepsMatch[2].trim();
    const decisions = ['DECISIONS.md', 'docs/DECISIONS.md'].map((f) => join(repoDir, f)).find(existsSync);
    if (!decisions) {
      die(`REFUSING: ${repo} declares KIT:KEEPS §${[...keeps].join(' §')} but has no DECISIONS.md.\n` +
          `A deviation must be recorded where the human reads it, not only in a kit marker.`, 1);
    }
    const missingBlock = [...keeps].filter((n) => !projBlocks.has(n));
    if (missingBlock.length) {
      die(`REFUSING: ${repo} declares KIT:KEEPS §${missingBlock.join(' §')} but supplies no PROJECT ` +
          `block for ${missingBlock.length > 1 ? 'those sections' : 'that section'}.\n` +
          `Keeping a core section means providing your own — otherwise the section vanishes.`, 1);
    }
    const notCore = [...keeps].filter((n) => !coreBlocks.has(n));
    if (notCore.length) {
      die(`REFUSING: ${repo} declares KIT:KEEPS §${notCore.join(' §')}, which the core does not own.\n` +
          `Only core sections (§${[...coreBlocks.keys()].sort((a, b) => a - b).join(' §')}) can be kept.`, 1);
    }
  }

  // A PROJECT block that reuses a CORE number is DATA LOSS, silently, in whichever direction
  // the spread happens to resolve. Real case: one repo's §10 was "PROJECT INVARIANTS" (data
  // residency, RLS everywhere, no hard deletes) while the kit's §10 is the telemetry ledger.
  // `new Map([...core, ...project])` let the project block win with no warning — the repo
  // would have lost the shared ledger, or the reverse, and nothing would have said so.
  // Refuse, and name the free slots. A composer built to stop silent drift must not cause it.
  // Declared keeps are exempt: those are overrides, not accidents.
  const collisions = [...projBlocks.keys()].filter((n) => coreBlocks.has(n) && !keeps.has(n));
  if (collisions.length) {
    const used = new Set([...coreBlocks.keys(), ...projBlocks.keys()]);
    const free = [];
    for (let n = 11; free.length < 3; n++) if (!used.has(n)) free.push(n);
    die(`REFUSING to compose ${repo}: §${collisions.join(' §')} exist in BOTH halves.\n` +
        `CORE owns §${[...coreBlocks.keys()].sort((a, b) => a - b).join(' §')} fleet-wide.\n` +
        `Renumber this repo's section(s) in .claude/CLAUDE.project.md to a free slot ` +
        `(§${free.join(', §')}) and keep the content — do not delete it.`, 1);
  }

  // A kept section is a declared override, and the composed file must SAY so — otherwise a
  // reader of CLAUDE.md cannot tell a deliberate deviation from a repo that missed a sync.
  const keptList = [...keeps].sort((a, b) => a - b).join(' §');
  const keptBanner = keeps.size
    ? `\n     KEPT by this repo (declared override, NOT synced): §${keptList}\n     Reason: ${keepsAdr}`
    : '';

  const merged = new Map([...coreBlocks, ...projBlocks]);
  const nums = [...merged.keys()].sort((a, b) => a - b);
  const banner =
`<!-- GENERATED by brain-kit/kit.mjs — do not hand-edit the CORE blocks.
     CORE    (§${[...coreBlocks.keys()].sort((a,b)=>a-b).join(' §')}) come from the kit's CLAUDE.core.md and are synced across every repo.
     PROJECT (§${[...projBlocks.keys()].sort((a,b)=>a-b).join(' §')}) come from this repo's .claude/CLAUDE.project.md and are yours.
     Edit a CORE section in the kit, not here, or the next sync will overwrite it.${keptBanner}
     Composed ${new Date().toISOString()} for ${repo}. -->

# PROJECT CONSTITUTION — ${repo}
`;
  const body = nums.map((n) => {
    const b = merged.get(n);
    return `<!-- KIT:${b.kind}:BEGIN §${n} -->\n${b.body}\n<!-- KIT:${b.kind}:END §${n} -->`;
  }).join('\n\n');
  const composed = banner + '\n' + body + '\n';

  if (cmd === 'compose') { process.stdout.write(composed); process.exit(0); }

  if (existsSync(claudeMd)) copyFileSync(claudeMd, claudeMd + '.bak');
  writeFileSync(claudeMd, composed, 'utf8');
  console.log(`applied ${repo}: §${nums.join(' §')}  (previous file → CLAUDE.md.bak)`);
  if (keeps.size) console.log(`  kept (declared override, not synced): §${keptList} — ${keepsAdr}`);
  process.exit(0);
}

// ── check: are this repo's CORE blocks canonical? ─────────────────────────────────────────
if (cmd === 'check') {
  const cur = readIf(claudeMd);
  if (!cur) die(`INCONCLUSIVE: ${repo} has no .claude/CLAUDE.md`, 2);
  const blocks = parseBlocks(cur);
  if (blocks.size === 0) die(`INCONCLUSIVE: ${repo}'s CLAUDE.md carries no kit markers (never composed)`, 2);

  // A section this repo declared it KEEPS is a deliberate override, not drift. Reading the
  // declaration from CLAUDE.project.md keeps one source of truth for it — the composed file's
  // banner is only a human-readable echo, and check must not trust an echo.
  const projForKeeps = readIf(projectMd) ?? '';
  const km = projForKeeps.match(/<!--\s*KIT:KEEPS\s+([0-9,\s]+?)\s*(?:—|--|-)\s*ADR:\s*([^>]*?)\s*-->/);
  const kept = new Set(km ? km[1].split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n)) : []);

  let bad = 0;
  for (const [n, canon] of coreBlocks) {
    if (kept.has(n)) { console.log(`  §${n}  KEPT (declared override — ${km[2].trim()})`); continue; }
    const got = blocks.get(n);
    if (!got) { console.log(`  §${n}  MISSING`); bad++; continue; }
    if (got.kind !== 'CORE') { console.log(`  §${n}  WRONG KIND (${got.kind})`); bad++; continue; }
    if (got.body.replace(/\r/g, '') !== canon.body.replace(/\r/g, '')) { console.log(`  §${n}  DRIFTED`); bad++; continue; }
    console.log(`  §${n}  ok`);
  }
  console.log(bad === 0 ? `${repo}: core is canonical` : `${repo}: ${bad} core section(s) differ`);
  process.exit(bad === 0 ? 0 : 1);
}

die(`unknown command: ${cmd}`, 2);
