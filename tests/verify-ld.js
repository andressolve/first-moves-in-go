// Exhaustively checks every puzzle that carries an `ld` field in a lesson page.
const fs = require('fs');
const { makeSolver, Go, KILL, LIVE, NAMES } = require('./ld-solver.js');
const html = fs.readFileSync(process.argv[2], 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const calls = [];
global.Go = Object.assign({}, Go, { ui: new Proxy({}, { get: (t, k) => k === 'initLesson' ? () => {} : (el, spec) => calls.push({ name: k, el, spec }) }) });
scripts.forEach(s => new Function(s)());
let problems = 0; const bad = m => { problems++; console.log('  !! ' + m); };
const puzzles = [];
for (const c of calls) {
  if (c.name === 'puzzleSet') c.spec.puzzles.forEach((p, k) => puzzles.push([`${c.el} #${k + 1}`, p]));
  if (c.name === 'puzzle') puzzles.push([c.el, c.spec]);
}
for (const [label, p] of puzzles) {
  if (!p.ld) { console.log(label, '(no ld)'); continue; }
  const b0 = Go.Board.fromRows(p.setup);
  const S = makeSolver(b0, p.ld.target, p.ld.wall);
  const me = p.toPlay === 'W' ? 2 : 1, op = 3 - me;
  const kill = me === S.attacker;
  const good = v => kill ? v === KILL : v === LIVE;
  console.log(`${label}: ${kill ? 'kill' : 'live'} (${me === 1 ? 'Black' : 'White'} to play), region ${S.region.length}`);
  // pass must not succeed
  { const c = b0.clone(); c.play('pass', me); if (good(S.value(c, op))) bad('passing also succeeds at the start'); }
  const walk = (b, node, path) => {
    const opts = S.moves(b, me).filter(([m]) => m !== 'pass');
    const winners = opts.filter(([, v]) => good(v)).map(([m]) => m).sort();
    const keys = Object.keys(node).sort();
    if (winners.join() !== keys.join()) bad(`${path || 'start'}: winners ${winners} but tree has ${keys}`);
    else console.log(`  ${path || 'start'}: correct moves ${keys.join(', ')}`);
    // refutations of each wrong move
    for (const [m, v] of opts) if (!good(v)) {
      const c = b.clone(); c.play(m, me);
      const ref = S.moves(c, op).filter(([, w]) => !good(w)).map(([x]) => x);
      const msg = p.wrong && p.wrong[m] ? ' [has text]' : (path ? ' [no text, deeper]' : ' [defaultWrong]');
      console.log(`    wrong ${path}${m}: refuted by ${ref.join(', ')}${msg}`);
    }
    for (const k of keys) {
      const a = node[k]; const c = b.clone();
      if (!c.play(k, me).ok) { bad(`${path}${k} illegal`); continue; }
      if (a.reply) {
        const replies = S.moves(c, op);
        const rv = replies.find(([x]) => x === a.reply);
        if (!rv) { bad(`${path}${k} reply ${a.reply} illegal`); continue; }
        console.log(`    after ${path}${k}: ${op === 1 ? 'Black' : 'White'} replies ${replies.map(([x, v]) => x + '=' + NAMES[v]).join(' ')}; scripted ${a.reply}`);
        if (!good(rv[1])) bad(`scripted reply ${a.reply} refutes ${k}`);
        c.play(a.reply, op);
        if (a.next) walk(c, a.next, `${path}${k} ${a.reply} `);
        else { if (!good(S.value(c, me))) bad('ends after reply in non-winning position'); }
      } else if (!a.win) bad(`${path}${k} has neither reply nor win`);
    }
  };
  walk(b0.clone(), p.tree, '');
  for (const k of Object.keys(p.wrong || {})) if (Object.keys(p.tree).includes(k)) bad(`wrong key ${k} is also a correct move`);
}
console.log(problems ? `\n${problems} PROBLEM(S)` : '\nAll life-and-death checks passed.');
