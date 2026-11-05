// render.cjs — turn scripts/real-run/captures/* into docs/assets/real-run.{gif,mp4}.
//
//   node scripts/real-run/render.cjs <frames-dir>          (needs playwright + Chrome + ffmpeg)
//
// The captures are the raw output of a real run (see captures/README.md). player.html draws a
// frame as a pure function of time, so this steps it 10 times a second and screenshots each
// frame: the same input always gives the same video.
const { chromium } = require('playwright');
const { readFileSync, mkdirSync } = require('fs');
const { join, resolve } = require('path');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');

const HERE = __dirname;
const ROOT = resolve(HERE, '..', '..');
const out = resolve(process.argv[2] || join(require('os').tmpdir(), 'brain-kit-real-run'));
mkdirSync(out, { recursive: true });
const cap = (f) => readFileSync(join(HERE, 'captures', f), 'utf8');
const FPS = 10;

(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 }, deviceScaleFactor: 1 });
  await p.goto(pathToFileURL(join(HERE, 'player.html')).href);
  const total = await p.evaluate((c) => window.load(c), {
    setup: cap('1-setup.txt'), before: cap('2-doctor-before.txt'), session: cap('3-claude-session.txt'),
    diff: cap('3-brain-diff.txt'), after: cap('4-doctor-after.txt'),
  });
  const n = Math.ceil((total / 1000) * FPS);
  for (let i = 0; i < n; i++) {
    await p.evaluate((ms) => window.draw(ms), (i * 1000) / FPS);
    await p.screenshot({ path: join(out, `f${String(i).padStart(4, '0')}.png`) });
  }
  await b.close();
  console.log(`${n} frames (${(total / 1000).toFixed(1)} s) → ${out}`);
  const frames = join(out, 'f%04d.png');
  const pal = join(out, 'pal.png');
  const ff = (args) => execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
  ff(['-framerate', String(FPS), '-i', frames, '-vf', 'palettegen=stats_mode=diff:max_colors=64', pal]);
  ff(['-framerate', String(FPS), '-i', frames, '-i', pal, '-lavfi', 'paletteuse=dither=none:diff_mode=rectangle', '-loop', '0', join(ROOT, 'docs', 'assets', 'real-run.gif')]);
  ff(['-framerate', String(FPS), '-i', frames, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', join(ROOT, 'docs', 'assets', 'real-run.mp4')]);
  ff(['-i', join(out, `f${String(n - 20).padStart(4, '0')}.png`), join(ROOT, 'docs', 'assets', 'real-run-poster.png')]);
  console.log('wrote docs/assets/real-run.gif, real-run.mp4, real-run-poster.png');
})();
