// Click test for docs/lesson-6.html: every replay, puzzle and question, answered correctly.
module.exports = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const btn = (sel, label) => page.evaluate((s, l) => { const b = [...document.querySelectorAll(s + ' button')].find(x => x.textContent === l && !x.hidden && !x.disabled); if (!b) return false; b.click(); return true; }, sel, label);
  const choose = (sel, start) => page.evaluate((s, t) => { const b = [...document.querySelectorAll(s + ' .choice')].find(x => x.textContent.startsWith(t)); b.click(); }, sel, start);
  const play = async (sel, moves, gap) => { for (const m of moves) { await clickPoint(sel, m); await wait(gap || 900); } };
  await page.evaluate(() => localStorage.clear());
  await page.reload(); await wait(500);

  for (const r of ['#w-two-weak', '#w-tiger', '#w-uncut', '#w-cuttable', '#w-backfire']) {
    while (await btn(r, 'Next')) await wait(60);
    console.log(r, '->', (await status(r)).slice(0, 90));
  }
  // Wrong answer first, then the right ones.
  await clickPoint('#w-connect-set', 'D6'); console.log('connect wrong:', (await status('#w-connect-set')).slice(0, 80)); await wait(1500);
  await clickPoint('#w-connect-set', 'E3'); console.log('connect #1:', (await status('#w-connect-set')).slice(0, 80));
  await btn('#w-connect-set', 'Next problem'); await wait(200);
  await clickPoint('#w-connect-set', 'D2'); console.log('connect #2 wrong:', (await status('#w-connect-set')).slice(0, 80)); await wait(1500);
  await clickPoint('#w-connect-set', 'D3'); console.log('connect #2:', (await status('#w-connect-set')).slice(0, 80));

  await play('#w-wedge', ['D5', 'C3', 'F3', 'F2', 'D1', 'G1']);
  console.log('wedge:', (await status('#w-wedge')).slice(0, 80));
  await choose('#w-which-shape', 'C:'); console.log('which-shape:', (await status('#w-which-shape')).slice(0, 60));

  for (const p of ['C8', 'F6', 'D3']) await clickPoint('#w-pick-cuts', p);
  await btn('#w-pick-cuts', 'Check'); console.log('pick:', (await status('#w-pick-cuts')).slice(0, 60));

  await play('#w-cut-set', ['D3', 'A3', 'A2', 'C1', 'A1']);
  console.log('cut #1:', (await status('#w-cut-set')).slice(0, 80));
  await btn('#w-cut-set', 'Next problem'); await wait(200);
  await play('#w-cut-set', ['F5', 'F4', 'C4', 'D2']);
  console.log('cut #2:', (await status('#w-cut-set')).slice(0, 80));
  await btn('#w-cut-set', 'Next problem'); await wait(200);
  await clickPoint('#w-cut-set', 'D3'); console.log('cut #3:', (await status('#w-cut-set')).slice(0, 80));

  await choose('#w-crosscut', 'B:'); console.log('crosscut wrong:', (await status('#w-crosscut')).slice(0, 60));
  await choose('#w-crosscut', 'A:'); console.log('crosscut:', (await status('#w-crosscut')).slice(0, 60));

  await clickPoint('#w-game', 'E5'); await wait(4000);
  console.log('game:', (await status('#w-game')).slice(0, 80));
  console.log('progress:', await page.evaluate(() => document.querySelector('[data-progress-text]').textContent));
};
