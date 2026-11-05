// diagnose.mjs — the PURE half of `doctor`: grade a brain from file contents, no fs, no node:*.
//
// It is pure so the same code runs in two places: `agent-brain-kit doctor` (lib/doctor.mjs reads
// the files and calls this) and the in-browser doctor on the website (docs/assets/diagnose.js is
// a byte-identical copy — the site is served from docs/ and cannot reach lib/). The test suite
// fails if the two copies differ, so the website can never grade differently from the CLI.
//
// TOLERANT PARSING, deliberately. Brains are hand-written: headings drift ("## 5. Gotchas",
// "## §5 GOTCHAS", "### 5) gotchas"), files arrive CRLF from Windows checkouts, and `#` lines
// inside code fences are not headings. A strict parser would report a healthy brain as broken
// — and a health check that cries wolf is ignored, which is worse than no check at all.

export const PASS_MARK = 70;

// The seven core sections, matched by NAME first and NUMBER second, so a brain that renumbered
// still passes and one that kept numbers but renamed a section still passes.
const CORE = [
  [1, 'WHAT THIS IS', /what this is|overview|about this/i],
  [2, 'ARCHITECTURE', /architecture/i],
  [3, 'CURRENT STATE', /current state/i],
  [4, 'OUTSTANDING', /outstanding|backlog|open items/i],
  [5, 'GOTCHAS', /gotcha/i],
  [6, 'CHANGELOG', /changelog|session log/i],
  [7, 'DECISIONS', /decision/i],
];
export const CREW = ['builder', 'explore', 'planner', 'qa', 'researcher', 'reviewer', 'test-writer'];

// A template placeholder LINE: `<One paragraph…`, `- <e.g. …>`, `- **Stack:** <framework…>`.
// Line-anchored on purpose: a real brain legitimately says `docs/research/<topic>.md` mid-line.
const PLACEHOLDER_LINE = /^\s*(?:[-*]\s+)?(?:\*\*[^*\n]+\*\*\s*:?\s*)?<[A-Za-z]/;

/**
 * Grade a brain from its CONTENTS, with no filesystem access — so the CLI and the website run
 * the same code. `files` is { brain: string|null, loopFiles: [{ name, text }], agents: [name] }.
 * `today` is injectable so a test (or a page in another time zone) gets a stable answer.
 */
export function diagnoseFiles({ brain = null, loopFiles = [], agents = [] } = {}, { dir = '', today = new Date() } = {}) {
  const checks = [];
  const add = (id, status, points, max, message, fix) => checks.push({ id, status, points, max, message, fix: status === 'pass' || status === 'info' ? undefined : fix });

  const hasBrain = typeof brain === 'string';
  const bytes = hasBrain ? new TextEncoder().encode(brain).length : 0;
  const text = hasBrain ? brain.replace(/\r\n?/g, '\n') : '';
  const lines = text.split('\n');

  // ── 1. exists ────────────────────────────────────────────────────────────────────────────
  if (hasBrain) add('brain-exists', 'pass', 10, 10, `BRAIN.md exists (${kb(bytes)})`);
  else add('brain-exists', 'fail', 0, 10, 'no BRAIN.md in this directory', 'run `npx agent-brain-kit setup` to create one from the template');

  const sections = hasBrain ? findSections(lines) : new Map();
  const body = (n) => sections.get(n)?.body ?? null;

  // ── 2. the seven core sections ─────────────────────────────────────────────────────────
  if (hasBrain) {
    const missing = CORE.filter(([n]) => !sections.has(n));
    const pts = Math.round((15 * (CORE.length - missing.length)) / CORE.length);
    if (!missing.length) add('sections', 'pass', 15, 15, 'core sections §1–§7 all present');
    else add('sections', 'fail', pts, 15, `missing ${missing.map(([n, name]) => `§${n} ${name}`).join(', ')}`,
      `add a "## <n>. <NAME>" heading for each — copy them from templates/BRAIN.template.md`);
  } else add('sections', 'fail', 0, 15, 'core sections — no brain to check', 'create BRAIN.md first');

  // ── 3. §1 and §2 actually filled (the cold-start context) ────────────────────────────────
  if (hasBrain) {
    const unfilled = [1, 2].filter((n) => { const b = body(n); return b === null || !hasRealContent(b) || hasPlaceholder(b); });
    const pts = 5 * (2 - unfilled.length);
    if (!unfilled.length) add('filled', 'pass', 10, 10, '§1 What this is and §2 Architecture are filled in');
    else add('filled', 'fail', pts, 10, `${unfilled.map((n) => `§${n}`).join(' and ')} still template placeholders (or empty)`,
      'ask your agent: "read the codebase and fill BRAIN.md §1–§2" — that is what makes a cold session warm');
  } else add('filled', 'fail', 0, 10, '§1–§2 filled — no brain to check', 'create BRAIN.md first');

  // ── 4. Last updated ──────────────────────────────────────────────────────────────────────
  if (hasBrain) {
    const lu = lines.find((l) => /last updated/i.test(l));
    const m = lu && lu.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!lu) add('last-updated', 'fail', 0, 10, 'no "Last updated" line', 'add `**Last updated:** YYYY-MM-DD by <who>` under the title and bump it every session');
    else if (!m) add('last-updated', 'warn', 3, 10, '"Last updated" line has no YYYY-MM-DD date', 'write the date as YYYY-MM-DD so staleness can be measured');
    else {
      const age = ageDays(m[0], today);
      const when = `${m[0]} (${age <= 0 ? 'today' : age === 1 ? 'yesterday' : `${age} days ago`})`;
      if (age < 7) add('last-updated', 'pass', 10, 10, `last updated ${when}`);
      else if (age <= 30) add('last-updated', 'warn', 6, 10, `last updated ${when} — getting stale`, 'bump "Last updated" at the end of every session that changes anything');
      else add('last-updated', 'warn', 2, 10, `last updated ${when} — STALE`, 'a brain nobody updates gets re-investigated instead of read; refresh §3 and bump the date');
    }
  } else add('last-updated', 'fail', 0, 10, '"Last updated" — no brain to check', 'create BRAIN.md first');

  // ── 5. §5 GOTCHAS has a real entry ─────────────────────────────────────────────────────
  if (hasBrain) {
    const b = body(5);
    const entries = b === null ? [] : b.split('\n').filter((l) => /^\s*(?:[-*]|\d+\.)\s+\S/.test(l) || /^#{3,}\s/.test(l)).filter((l) => !PLACEHOLDER_LINE.test(l.replace(/^#{3,}\s*/, '- ')));
    if (entries.length) add('gotchas', 'pass', 15, 15, `§5 GOTCHAS has ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
    else add('gotchas', 'fail', 0, 15, `§5 GOTCHAS has no real entry${b === null ? ' (section missing)' : ' (template placeholders only)'}`,
      'record the first thing that cost you an hour — the most valuable section, and the one that is normally lost');
  } else add('gotchas', 'fail', 0, 15, '§5 GOTCHAS — no brain to check', 'create BRAIN.md first');

  // ── 6. §6 CHANGELOG has entries, and the newest says where it left off ───────────────────
  if (hasBrain) {
    const entries = changelogEntries(body(6));
    if (!entries.length) {
      add('changelog', 'fail', 0, 10, '§6 CHANGELOG has no entries', 'append a "### YYYY-MM-DD — what happened" entry at the end of every session');
      add('left-off', 'fail', 0, 5, 'no newest changelog entry to carry a "left off" pointer', 'end each entry with "Left off: <exact resume point>"');
    } else {
      add('changelog', 'pass', 10, 10, `§6 CHANGELOG has ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
      const newest = entries.reduce((a, e) => (e.date && (!a.date || e.date > a.date) ? e : a), entries[0]);
      if (/left off|resume here|\bnext\b/i.test(newest.text)) add('left-off', 'pass', 5, 5, `newest entry (${newest.title}) says where it left off`);
      else add('left-off', 'fail', 0, 5, `newest entry (${newest.title}) has no "left off" / "next" pointer`,
        'end it with "Left off: <exact state>" — the line the next session resumes from');
    }
  } else {
    add('changelog', 'fail', 0, 10, '§6 CHANGELOG — no brain to check', 'create BRAIN.md first');
    add('left-off', 'fail', 0, 5, '"left off" pointer — no brain to check', 'create BRAIN.md first');
  }

  // ── 7. §4 OUTSTANDING table parses ────────────────────────────────────────────────────
  // A LITERAL `|` INSIDE A CELL BREAKS THE ROW — EVEN INSIDE BACKTICKS. Markdown splits on it
  // before it sees the code span, so a summary quoting a table shape silently shifts every
  // column after it. Counting ROWS does not catch it ("7 rows" looked fine); counting CELLS per
  // row does. Escape it as \| .
  if (hasBrain) {
    const b = body(4);
    const table = b === null ? null : firstTable(b, sections.get(4).start);
    if (b === null) add('outstanding', 'fail', 0, 5, '§4 OUTSTANDING missing', 'add §4 with an id | sev | type | summary | status | added table');
    else if (!table) add('outstanding', 'warn', 5, 5, '§4 OUTSTANDING has no table (fine if you keep a list)');
    else {
      const bad = table.rows.filter((r) => r.cells !== table.header);
      if (!bad.length) add('outstanding', 'pass', 5, 5, `§4 OUTSTANDING table parses (${table.rows.length - 1 - table.rows.filter((r) => r.sep).length} rows, ${table.header} columns)`);
      else add('outstanding', 'fail', 0, 5,
        `§4 table: ${bad.slice(0, 3).map((r) => `line ${r.line} has ${r.cells} cells`).join(', ')}${bad.length > 3 ? ` (+${bad.length - 3} more)` : ''} — header has ${table.header}`,
        'a literal | inside a cell splits the row, even inside `backticks` — escape it as \\|');
    }
  } else add('outstanding', 'fail', 0, 5, '§4 OUTSTANDING — no brain to check', 'create BRAIN.md first');

  // ── 8. the loop is enforced where the agent reads first ──────────────────────────────────
  const loop = loopFiles.map(({ name, text: t }) => ({ f: name, ...loopIn(t) }));
  const loopNames = loopFiles.map((l) => l.name);
  const full = loop.find((l) => l.read && l.write);
  const half = loop.find((l) => l.read || l.write);
  if (full) add('loop', 'pass', 15, 15, `${full.f} carries the read-first / write-before-ending loop`);
  else if (half) add('loop', 'warn', 8, 15, `${half.f} mentions BRAIN.md but not the whole loop (${half.read ? 'no write-back' : 'no read-first'})`,
    'paste BRAIN_DISCIPLINE.md into it — reading AND writing the brain, every session');
  else if (loopNames.length) add('loop', 'fail', 0, 15, `${loopNames.join(', ')} never tell${loopNames.length === 1 ? 's' : ''} the agent to read BRAIN.md`,
    `paste BRAIN_DISCIPLINE.md (from the kit) into ${loopNames[0]} — the read-first / write-before-ending loop`);
  else add('loop', 'fail', 0, 15, 'no CLAUDE.md or AGENTS.md telling the agent to read BRAIN.md',
    'run `npx agent-brain-kit setup` (writes .claude/CLAUDE.md), or paste BRAIN_DISCIPLINE.md into your AGENTS.md');

  // ── 9. size ──────────────────────────────────────────────────────────────────────────────
  // GitHub's contents API stops inlining file content at 1 MB, so any tool reading the brain
  // remotely gets nothing back past that — and long before it, a brain that big costs every
  // session a large slice of its context window just to start.
  if (hasBrain) {
    const n = bytes;
    if (n > 1024 * 1024) add('size', 'fail', 0, 5, `BRAIN.md is ${kb(n)} — over 1 MB`, 'move old §6 changelog entries to an archive file; GitHub stops inlining content past 1 MB');
    else if (n > 500 * 1024) add('size', 'warn', 3, 5, `BRAIN.md is ${kb(n)} — getting heavy`, 'archive the oldest §6 entries; every session pays for this file in context');
    else add('size', 'pass', 5, 5, `size ${kb(n)} (limit 1 MB)`);
  } else add('size', 'fail', 0, 5, 'size — no brain to check', 'create BRAIN.md first');

  // ── crew (informational: a brain is healthy without one) ─────────────────────────────────
  const present = CREW.filter((a) => agents.includes(a));
  add('crew', 'info', 0, 0, present.length ? `crew: ${present.length}/${CREW.length} agents in .claude/agents${present.length < CREW.length ? ` (missing ${CREW.filter((a) => !present.includes(a)).join(', ')})` : ''}` : 'crew: none installed (optional — `setup` adds it)');

  const score = checks.reduce((s, ch) => s + ch.points, 0);
  const max = checks.reduce((s, ch) => s + ch.max, 0);
  return { dir, score, max, pass: score >= PASS_MARK, passMark: PASS_MARK, checks };
}

// ── parsing helpers ───────────────────────────────────────────────────────────────────────

/** Map<sectionNumber, {title, start, body}> for the core sections, fence-aware. */
export function findSections(lines) {
  const heads = [];
  let fence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) { fence = !fence; return; }
    if (fence) return;
    const m = l.match(/^(#{1,4})\s+(.*?)\s*#*\s*$/);
    if (m) heads.push({ level: m[1].length, text: m[2], i });
  });
  const numOf = (t) => { const m = t.match(/^(?:§\s*)?(\d{1,2})\s*[.):\-—]?\s/); return m ? Number(m[1]) : null; };
  const out = new Map();
  for (const [n, , re] of CORE) {
    // Name first (only among ## / ### headings, never the # title), then number.
    let h = heads.find((x) => x.level >= 2 && x.level <= 3 && re.test(x.text) && (numOf(x.text) === null || numOf(x.text) === n))
      ?? heads.find((x) => x.level >= 2 && x.level <= 3 && numOf(x.text) === n)
      ?? heads.find((x) => x.level >= 2 && x.level <= 3 && re.test(x.text));
    if (!h) continue;
    const next = heads.find((x) => x.i > h.i && x.level <= h.level);
    out.set(n, { title: h.text, start: h.i + 1, body: lines.slice(h.i + 1, next ? next.i : lines.length).join('\n') });
  }
  return out;
}

function hasPlaceholder(body) {
  return body.split('\n').some((l) => !/^\s*>/.test(l) && PLACEHOLDER_LINE.test(l));
}
function hasRealContent(body) {
  return body.split('\n').some((l) => l.trim() && !/^\s*>/.test(l) && !/^\s*-{3,}\s*$/.test(l) && !/^\s*<!--/.test(l));
}

function changelogEntries(body) {
  if (body === null) return [];
  const out = [];
  let cur = null;
  for (const l of body.split('\n')) {
    const m = l.match(/^#{3,4}\s+(.*)$/);
    if (m) {
      cur = { title: m[1].trim(), text: '' };
      const d = cur.title.match(/\d{4}-\d{2}-\d{2}/);
      cur.date = d ? d[0] : null;
      out.push(cur);
    } else if (cur) cur.text += l + '\n';
  }
  // A heading still holding template tokens (`### <YYYY-MM-DD> — <session ref>`) is not an entry.
  return out.filter((e) => !/<[A-Za-z][^>]*>/.test(e.title)).map((e) => ({ ...e, title: e.title.length > 48 ? e.title.slice(0, 47) + '…' : e.title }));
}

const cellCount = (l) => {
  let s = l.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  return s.split(/(?<!\\)\|/).length;
};
function firstTable(body, startLine) {
  const ls = body.split('\n');
  const i0 = ls.findIndex((l) => /^\s*\|/.test(l));
  if (i0 === -1) return null;
  const rows = [];
  for (let i = i0; i < ls.length && /^\s*\|/.test(ls[i]); i++) {
    // The |---|---| separator is a row for cell counting (a short one breaks rendering too)
    // but not a DATA row, so it is excluded from the count the report prints.
    rows.push({ line: startLine + i + 1, cells: cellCount(ls[i]), sep: /^[\s|:-]+$/.test(ls[i]) && ls[i].includes('-') });
  }
  return { header: rows[0].cells, rows };
}

export function loopIn(t) {
  const mentions = /BRAIN\.md/.test(t);
  return {
    read: mentions && /READ FIRST|read\b[^\n]{0,60}BRAIN\.md|BRAIN\.md[^\n]{0,60}\bbefore\b/i.test(t),
    write: mentions && /WRITE BEFORE ENDING|(update|write)\b[^\n]{0,40}BRAIN\.md|BRAIN\.md[^\n]{0,60}\b(after|before (the session )?end)/i.test(t),
  };
}

function ageDays(iso, now) {
  const [y, m, d] = iso.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - then) / 86400000);
}
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`);
