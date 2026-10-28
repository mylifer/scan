// assets/icon.svg dosyasından uygulamanın tüm simge PNG'lerini üretir.
// Kullanım: node scripts/render-icons.cjs   (Playwright + Chromium gerekir)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'assets/icon.svg'), 'utf8');

// Android uyarlanabilir simgede ön plan, güvenli alana sığması için küçültülür.
const ANDROID_SCALE = 0.7;

const outputs = [
  { file: 'assets/icon.png', size: 1024 },
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'assets/favicon.png', size: 48, rounded: true },
  { file: 'assets/android-icon-background.png', size: 1024, hide: ['foreground'] },
  { file: 'assets/android-icon-foreground.png', size: 1024, hide: ['background'], scale: ANDROID_SCALE },
  {
    file: 'assets/android-icon-monochrome.png',
    size: 1024,
    hide: ['background', 'glow', 'lines'],
    scale: ANDROID_SCALE,
    css: '#foreground *{stroke:#000;stroke-opacity:1;filter:none} #paper,#scanline{fill:#000}',
  },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const o of outputs) {
    const radius = o.rounded ? 'border-radius:22.5%;overflow:hidden;' : '';
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block}${o.css ?? ''}</style>` +
        `<div id="box" style="width:${o.size}px;height:${o.size}px;${radius}">${source}</div>`,
    );
    await page.evaluate(({ size, hide, scale }) => {
      const svg = document.querySelector('svg');
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      for (const id of hide ?? []) document.getElementById(id)?.remove();
      if (scale) {
        const t = 512 * (1 - scale);
        document.getElementById('foreground').setAttribute('transform', `translate(${t} ${t}) scale(${scale})`);
      }
    }, o);
    await page.locator('#box').screenshot({ path: path.join(root, o.file), omitBackground: true });
    console.log('yazıldı:', o.file);
  }
  await browser.close();
})();
