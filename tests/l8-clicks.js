// Click-through for lesson 8: node tests/ui-click.test.js docs/lesson-8.html tests/l8-clicks.js
module.exports = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const btn = (sel, text) => page.evaluate((sel, text) => {
    const b = [...document.querySelectorAll(sel + ' button')].find(x => x.textContent.trim() === text && !x.hidden && !x.disabled);
    if (b) b.click(); return !!b;
  }, sel, text);
  const toEnd = async sel => { while (await btn(sel, 'Next')) await wait(80); };

  // Part 1
  for (const p of ['B1', 'C1', 'D1', 'E1', 'B2', 'C2', 'D2']) await clickPoint('#w-space', p);
  await btn('#w-space', 'Check');
  console.log('space:', await status('#w-space'));

  // Part 2 to 6: replays and choices
  for (const sel of ['#w-straight4', '#w-square4', '#w-shapes', '#w-false-demo', '#w-reduce', '#w-seki']) { await toEnd(sel); console.log(sel, '->', (await status(sel)).slice(0, 90)); }
  const choose = (sel, k) => page.evaluate((sel, k) => document.querySelectorAll(sel + ' .choice')[k].click(), sel, k);
  await choose('#w-bent4', 0); console.log('bent4:', (await status('#w-bent4')).slice(0, 60));
  await choose('#w-pyramid', 0); console.log('pyramid wrong:', (await status('#w-pyramid')).slice(0, 60));
  await choose('#w-pyramid', 1); console.log('pyramid:', (await status('#w-pyramid')).slice(0, 60));
  await choose('#w-false-q', 1); console.log('false-q:', (await status('#w-false-q')).slice(0, 60));

  // Seki count
  await page.evaluate(() => { document.getElementById('l8c1-b').value = '36'; document.getElementById('l8c1-w').value = '43'; });
  await btn('#w-seki-count', 'Check');
  console.log('seki count:', (await status('#w-seki-count')).slice(0, 80));

  // Part 7: the problem set
  const answers = [['A5'], ['E1'], ['F3'], ['E6'], ['D2'], ['C2'], ['E1'], ['F1', 'C1']];
  for (let k = 0; k < answers.length; k++) {
    await page.evaluate(k => document.querySelectorAll('#w-set .pset-dot')[k].click(), k);
    await wait(100);
    if (k === 0) { await clickPoint('#w-set', 'A6'); console.log('set 1 wrong:', await status('#w-set')); await wait(1500); }
    for (const m of answers[k]) { await clickPoint('#w-set', m); await wait(900); }
    console.log(`set ${k + 1}:`, (await status('#w-set')).slice(0, 70));
  }
  // The second route through problem 8
  await btn('#w-set', 'Try again'); await wait(100);
  for (const m of ['C1', 'F1']) { await clickPoint('#w-set', m); await wait(900); }
  console.log('set 8 alt:', (await status('#w-set')).slice(0, 70));

  // Full game: a few moves
  for (const m of ['E5', 'C3']) { await clickPoint('#w-game', m); await wait(2500); }
  console.log('game:', await status('#w-game'));
  console.log('progress:', await page.evaluate(() => document.querySelector('[data-progress-text]').textContent));

  // Phone width
  await page.setViewport({ width: 390, height: 844 });
  await wait(300);
  console.log('overflow at 390:', await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]));
  await page.setViewport({ width: 1280, height: 900 });
  if (process.env.SHOTS) {
    for (const sel of ['#w-shapes', '#w-false-q', '#w-reduce', '#w-seki-count', '#w-set']) {
      const el = await page.$(sel);
      await el.screenshot({ path: `${process.env.SHOTS}/${sel.slice(1)}.png` });
    }
  }
};
