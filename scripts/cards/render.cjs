// render.cjs — share images, all from one template (card.html):
//
//   docs/assets/og.png              1200×630  link preview (og:image / twitter:image)
//   docs/assets/social-preview.png  1280×640  GitHub repo social preview (upload it in Settings)
//   docs/cards/NN-slug.png          1200×675  one card per Hall of Gotchas entry
//
//   node scripts/cards/render.cjs          (needs playwright + Chrome)
//
// The gotcha cards are parsed from docs/hall-of-gotchas.md, so a card can never say something
// the Hall does not. Re-run after editing the Hall.
const { chromium } = require('playwright');
const { readFileSync, mkdirSync, readdirSync, unlinkSync } = require('fs');
const { join, resolve } = require('path');
const { pathToFileURL } = require('url');

const ROOT = resolve(__dirname, '..', '..');

function parseHall() {
  const md = readFileSync(join(ROOT, 'docs', 'hall-of-gotchas.md'), 'utf8').replace(/\r\n?/g, '\n');
  const parts = md.split(/^### /m).slice(1);
  return parts.map((p) => {
    const [head, ...rest] = p.split('\n');
    const m = head.match(/^(\d+)\.\s+(.*)$/);
    const body = rest.join('\n').split(/\n---\n/)[0];
    const ruleAt = body.indexOf('**The rule it became:**');
    if (!m || ruleAt < 0) throw new Error(`cannot parse gotcha: ${head}`);
    const story = body.slice(0, ruleAt).trim().replace(/\s*\n\s*/g, ' ');
    const after = body.slice(ruleAt + '**The rule it became:**'.length).trim();
    const tagLine = after.split('\n').reverse().find((l) => /^`[^`]+`(\s+`[^`]+`)*\s*$/.test(l.trim())) || '';
    const rule = after.slice(0, tagLine ? after.lastIndexOf(tagLine) : undefined).trim().replace(/\s*\n\s*/g, ' ');
    const tags = [...tagLine.matchAll(/`([^`]+)`/g)].map((x) => x[1]);
    return { n: Number(m[1]), title: m[2].trim(), story, rule, tags };
  });
}

const slug = (s) => s.toLowerCase().replace(/`/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '');

(async () => {
  const items = parseHall();
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(join(__dirname, 'card.html')).href, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);

  const shot = async (w, h, path) => { await p.setViewportSize({ width: w, height: h }); await p.screenshot({ path, clip: { x: 0, y: 0, width: w, height: h } }); };

  await p.evaluate(() => window.og(1200, 630)); await shot(1200, 630, join(ROOT, 'docs', 'assets', 'og.png'));
  await p.evaluate(() => window.og(1280, 640)); await shot(1280, 640, join(ROOT, 'docs', 'assets', 'social-preview.png'));

  const dir = join(ROOT, 'docs', 'cards');
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) if (f.endsWith('.png')) unlinkSync(join(dir, f));
  const bad = [];
  for (const it of items) {
    const r = await p.evaluate(([d]) => window.gotcha(d, 1200, 675), [{ ...it, of: items.length }]);
    const name = `${String(it.n).padStart(2, '0')}-${slug(it.title)}.png`;
    await shot(1200, 675, join(dir, name));
    console.log(`${name}  body ${r.size}px ${r.cut}${r.overflow ? '  OVERFLOW' : ''}`);
    if (r.overflow) bad.push(name);
  }
  await b.close();
  if (bad.length) { console.error(`${bad.length} card(s) overflow: ${bad.join(', ')}`); process.exit(1); }
})();
