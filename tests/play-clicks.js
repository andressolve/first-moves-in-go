// Click test for docs/play.html (two players on one screen).
module.exports = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const btn = label => page.evaluate(l => { const b = [...document.querySelectorAll('#w-friend button')].find(x => x.textContent === l && !x.hidden); if (!b) return false; b.click(); return true; }, label);
  const stones = () => page.evaluate(() => document.querySelectorAll('#w-friend .stone:not(.ghost):not(.leaving)').length);
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await wait(400);
  // Black surrounds and captures a white stone at E5.
  for (const m of ['D5', 'E5', 'F5', 'A1', 'E6', 'A2', 'E4']) await clickPoint('#w-friend', m);
  console.log('capture:', await status('#w-friend'), '| stones', await stones());
  await clickPoint('#w-friend', 'E5'); // white plays back into the hole: suicide
  console.log('suicide:', await status('#w-friend'));
  await btn('Pass'); console.log('one pass:', await status('#w-friend'));
  await btn('Pass'); await wait(800);
  console.log('scoring:', await status('#w-friend'));
  console.log('score box:', (await page.evaluate(() => document.querySelector('#w-friend .w-score').innerText)).replace(/\s+/g, ' '));
  await clickPoint('#w-friend', 'A1'); // toggle white group dead/alive
  console.log('after toggle:', (await page.evaluate(() => document.querySelector('#w-friend .score-result').innerText)));
  await btn('Accept the result'); console.log('accepted:', await status('#w-friend'));
  // 19x19 with 4 handicap stones
  await page.select('#pf-size', '19'); await page.select('#pf-handicap', '4');
  console.log('komi after handicap:', await page.$eval('#pf-komi', e => e.value));
  await btn('Start new game'); await wait(300);
  console.log('19x19:', await status('#w-friend'), '| stones', await stones(), '| lines', await page.evaluate(() => document.querySelectorAll('#w-friend .grid line').length));
  await clickPoint('#w-friend', 'K10'); await clickPoint('#w-friend', 'Q3');
  await page.reload(); await wait(500);
  console.log('restored:', await status('#w-friend'), '| stones', await stones());
  await btn('Undo'); console.log('undo stones', await stones());
};
