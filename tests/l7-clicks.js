// Click-through for Lesson 7: every question's correct answer and every puzzle's solution.
module.exports = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const pick = async (sel, text) => {
    await page.evaluate((sel, text) => [...document.querySelectorAll(sel + ' .choice')].find(b => b.textContent.startsWith(text)).click(), sel, text);
    console.log(sel, '->', (await status(sel)).slice(0, 70));
  };
  const stepAll = async sel => {
    for (let k = 0; k < 6; k++) await page.evaluate(sel => [...document.querySelectorAll(sel + ' button')].find(b => b.textContent === 'Next').click(), sel);
    console.log(sel, 'last step:', (await status(sel)).slice(0, 70));
  };
  await stepAll('#w-sente');
  await pick('#w-q-cut', 'Yes');
  await pick('#w-q-touch', 'No');
  await pick('#w-q-capture', 'Take');
  await stepAll('#w-gote');
  await pick('#w-q-side', 'A');
  await pick('#w-q-tenuki1', 'Play tenuki');
  await pick('#w-q-tenuki2', 'No');
  await stepAll('#w-ko');
  await pick('#w-q-when', 'Later');
  // Puzzle 1: a wrong move first, then the solution.
  await clickPoint('#w-set', 'C3'); console.log('p1 wrong:', (await status('#w-set')).slice(0, 80)); await wait(1500);
  await clickPoint('#w-set', 'G5'); await wait(900); await clickPoint('#w-set', 'C3'); console.log('p1:', (await status('#w-set')).slice(0, 80));
  const next = () => page.evaluate(() => [...document.querySelectorAll('#w-set .pset-nav button')].find(b => b.textContent === 'Next problem').click());
  await next(); await wait(200);
  await clickPoint('#w-set', 'E2'); await wait(900); await clickPoint('#w-set', 'G7'); console.log('p2:', (await status('#w-set')).slice(0, 80));
  await next(); await wait(200);
  await clickPoint('#w-set', 'D2'); console.log('p3 illegal retake:', (await status('#w-set')).slice(0, 80));
  await clickPoint('#w-set', 'H5'); await wait(900); await clickPoint('#w-set', 'D2'); console.log('p3:', (await status('#w-set')).slice(0, 80));
  for (const m of ['E5', 'C3']) { await clickPoint('#w-game', m); await wait(3000); }
  console.log('game:', (await status('#w-game')).slice(0, 80));
  console.log('progress:', await page.evaluate(() => document.querySelector('[data-progress-text]').textContent));
  await page.setViewport({ width: 390, height: 844 });
  await wait(300);
  console.log('390px overflow:', await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]));
  await page.setViewport({ width: 1280, height: 900 });
  for (const [sel, f] of [['#w-sente', 'l7-sente.png'], ['#w-q-cut', 'l7-cut.png'], ['#w-set', 'l7-set.png'], ['#w-ko', 'l7-ko.png']]) {
    const el = await page.$(sel); await el.screenshot({ path: (process.env.SHOTS || require('os').tmpdir()) + '/' + f });
  }
};
