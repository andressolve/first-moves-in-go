// Usage: node tests/ui-click.test.js dist/lesson-1.html
// Needs puppeteer-core (installed in the scratchpad); clicks through widgets.
const path = require('path');
const puppeteer = require(process.env.PUPPETEER || 'puppeteer-core');
const file = path.resolve(process.argv[2]);
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + file);
  await new Promise(r => setTimeout(r, 500));
  // click a named point on the first board inside a widget
  global.clickPoint = async (sel, name) => {
    await page.evaluate((sel, name) => {
      const svg = document.querySelector(sel + ' svg.goban');
      const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
      const n = Math.round(vb.width + 2 * vb.x + 1);
      const x = 'ABCDEFGHJKLMNOPQRST'.indexOf(name[0]), y = n - parseInt(name.slice(1));
      svg.scrollIntoView({ block: 'center' });
    }, sel, name);
    const pos = await page.evaluate((sel, name) => {
      const svg = document.querySelector(sel + ' svg.goban');
      const vb = svg.viewBox.baseVal, r = svg.getBoundingClientRect();
      const n = Math.round(vb.width + 2 * vb.x + 1);
      const x = 'ABCDEFGHJKLMNOPQRST'.indexOf(name[0]), y = n - parseInt(name.slice(1));
      return { x: r.left + (x - vb.x) / vb.width * r.width, y: r.top + (y - vb.y) / vb.height * r.height };
    }, sel, name);
    await page.mouse.click(pos.x, pos.y);
    await new Promise(r => setTimeout(r, 120));
  };
  global.status = sel => page.evaluate(sel => [...document.querySelectorAll(sel + ' .w-status')].map(e => e.textContent).join(' | '), sel);
  global.page = page;
  const script = process.argv[3] ? require(path.resolve(process.argv[3])) : null;
  if (script) await script();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'No page errors.');
  await browser.close();
})();
