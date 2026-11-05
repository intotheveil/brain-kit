// Renders docs/assets/demo.svg to frames for docs/assets/demo.gif (dark theme, 10 fps, 18 s).
// usage: node scripts/render-demo-gif.cjs <frames-dir>   (needs playwright + Chrome), then:
//   ffmpeg -framerate 10 -i <dir>/f%03d.png -vf palettegen=stats_mode=diff:max_colors=128 pal.png
//   ffmpeg -framerate 10 -i <dir>/f%03d.png -i pal.png -lavfi paletteuse=dither=none:diff_mode=rectangle -loop 0 docs/assets/demo.gif
const { chromium } = require('playwright');
const out = process.argv[2];
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const p = await b.newPage({ viewport: { width: 900, height: 372 }, colorScheme: 'dark', deviceScaleFactor: 1 });
  await p.goto(require('url').pathToFileURL(require('path').resolve(__dirname, '../docs/assets/demo.svg')).href);
  await p.waitForTimeout(300);
  console.log('animations', await p.evaluate(() => document.getAnimations().length));
  for (let i = 0; i < 180; i++) {
    await p.evaluate(t => document.getAnimations().forEach(a => { a.pause(); a.currentTime = t; }), i * 100);
    await p.screenshot({ path: `${out}/f${String(i).padStart(3,'0')}.png` });
  }
  await b.close();
})();
