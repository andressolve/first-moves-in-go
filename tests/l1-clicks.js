module.exports = async () => {
  const wait = ms => new Promise(r => setTimeout(r, ms));
  await clickPoint('#w-lib1', 'D5'); await clickPoint('#w-lib1', 'D3'); await clickPoint('#w-lib1', 'C4'); await clickPoint('#w-lib1', 'E4');
  await page.evaluate(() => [...document.querySelectorAll('#w-lib1 button')].find(b => b.textContent === 'Check').click());
  console.log('lib1:', await status('#w-lib1'));
  await clickPoint('#w-cap-set', 'D2'); console.log('cap wrong:', await status('#w-cap-set')); await wait(1500);
  await clickPoint('#w-cap-set', 'E4'); console.log('cap right:', await status('#w-cap-set'));
  await clickPoint('#w-save-set', 'D3'); console.log('save:', await status('#w-save-set'));
  // Capture game: play a few moves
  for (const m of ['D4', 'C3', 'E5', 'B2']) { await clickPoint('#w-game', m); await wait(900); }
  console.log('game:', await status('#w-game'));
  console.log('progress:', await page.evaluate(() => document.querySelector('[data-progress-text]').textContent));
};
