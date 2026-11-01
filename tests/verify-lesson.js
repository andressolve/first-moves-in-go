// Usage: node tests/verify-lesson.js src/lesson-1.html
// Runs the lesson's widget script against a recording mock, then checks every
// puzzle with the engine and prints what the engine thinks the answers are.
const fs = require('fs');
const Go = require('../src/go-engine.js');
const file = process.argv[2];
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const calls = [];
const rec = name => (el, spec) => calls.push({ name, el, spec });
global.Go = Object.assign({}, Go, { ui: new Proxy({}, { get: (t, k) => k === 'initLesson' ? () => {} : rec(k) }) });
scripts.forEach(s => new Function(s)());
let problems = 0;
const bad = msg => { problems++; console.log('  !! ' + msg); };
const colorOf = c => (c === 'W' ? 2 : 1);
function board(spec) { if (spec.board) return spec.board.clone(); const b = spec.setup ? Go.Board.fromRows(spec.setup) : new Go.Board(spec.size || 9); return b; }
function checkPuzzle(p, label) {
  const b = board(p); const me = colorOf(p.toPlay); b.toPlay = me;
  const legal = b.legalMoves(me);
  const name = i => b.name(i);
  if (p.mode === 'kill') {
    const t = b.idx(p.target);
    const tb = b.clone(); tb.toPlay = me;
    const winners = legal.filter(m => { const c = b.clone(); c.play(m, me); return !c.grid[t] || !Go.defend(c, t); });
    console.log(`${label} kill ${p.target}: winning first moves = ${winners.map(name).join(', ') || 'NONE'}`);
    if (!winners.length) bad('no winning move');
  } else if (p.mode === 'save') {
    const t = b.idx(p.target);
    const savers = legal.filter(m => { const c = b.clone(); c.play(m, me); const g = c.group(t); return g && (g.libs.size >= 3 || Go.attack(c, t) === null); });
    console.log(`${label} save ${p.target}: saving moves = ${savers.map(name).join(', ') || 'NONE'}`);
    if (savers.length !== 1) bad('expected exactly one saving move');
  } else if (p.answers) {
    const ans = Array.isArray(p.answers) ? p.answers : Object.keys(p.answers);
    for (const a of ans) {
      const c = b.clone(); const r = c.play(a, me);
      if (!r.ok) bad(`answer ${a} is illegal (${r.reason})`);
      console.log(`${label} answer ${a}: captures ${r.captured ? r.captured.length : 0}`);
    }
    // Other capturing moves that would be judged wrong:
    const caps = legal.filter(m => { const c = b.clone(); return c.play(m, me).captured.length > 0; }).map(name).filter(x => !ans.includes(x));
    if (caps.length) console.log(`${label}   note: other capturing moves: ${caps.join(', ')}`);
  } else if (p.tree) {
    let c = b.clone();
    const walk = (node, c, path) => { for (const [mv, a] of Object.entries(node)) { const d = c.clone(); const r = d.play(mv, me); if (!r.ok) bad(`${path}${mv} illegal ${r.reason}`); if (a.reply) { const r2 = d.play(a.reply, Go.opp(me)); if (!r2.ok) bad(`reply ${a.reply} illegal ${r2.reason}`); } if (a.next) walk(a.next, d, path + mv + ' '); else console.log(`${label} line ${path}${mv}${a.reply ? ' ' + a.reply : ''} ends: ${d.toRows().join('/')}`); } };
    walk(p.tree, c, '');
  } else console.log(`${label} (custom judge)`);
  for (const k of Object.keys(p.wrong || {})) { if (!b.clone().play(k, me).ok) bad(`wrong-key ${k} is illegal`); }
}
for (const c of calls) {
  const s = c.spec;
  try {
    if (c.name === 'puzzleSet') s.puzzles.forEach((p, k) => checkPuzzle(p, `${c.el} #${k + 1}`));
    else if (c.name === 'puzzle') checkPuzzle(s, c.el);
    else if (c.name === 'pickPoints') {
      const b = board(s); const t = typeof s.targets === 'function' ? [...s.targets(b)] : s.targets.map(x => b.idx(x));
      console.log(`${c.el} pickPoints targets: ${t.map(i => b.name(i)).join(' ')}`);
    } else if (c.name === 'replay') {
      let b = board(s);
      for (const st of s.steps) { if (st.remove) for (const p of st.remove) b.grid[b.idx(p)] = 0; if (st.add) for (const [p, c] of st.add) b.grid[b.idx(p)] = colorOf(c === 'B' || c === 'black' || c === 1 ? 'B' : 'W'); if (st.play) { const r = b.play(st.play, st.color ? colorOf(st.color) : b.toPlay); if (!r.ok) bad(`${c.el} replay ${st.play} ${r.reason}`); } }
      console.log(`${c.el} replay ok (${s.steps.length} steps)`);
    } else if (c.name === 'countQuiz') {
      const b = board(s); const sc = Go.scoreArea(b, new Set((s.dead || []).map(p => b.idx(p))), 0);
      console.log(`${c.el} count: black ${sc.black} (${sc.blackStones}+${sc.blackTerritory}), white ${sc.white} (${sc.whiteStones}+${sc.whiteTerritory})`);
    } else if (s && s.setup) { board(s); console.log(`${c.el} ${c.name} setup ok`); }
    else console.log(`${c.el} ${c.name}`);
  } catch (e) { bad(`${c.el}: ${e.message}`); }
}
console.log(problems ? `\n${problems} PROBLEM(S)` : '\nAll checks passed.');
