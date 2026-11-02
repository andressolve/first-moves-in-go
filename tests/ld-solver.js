// Exhaustive life-and-death solver for small enclosed positions.
// region: every point that is not part of the attacker's outer wall (and is
// not far outside). Moves are restricted to empty points of the region (plus pass).
const Go = require('../src/go-engine.js');
const { BLACK, WHITE, PASS } = Go;

// Region: flood from the target group through anything that is not the
// attacker's "wall" stones. wall = attacker stones connected to point wallAt.
function regionOf(b, target, wallAt, only) {
  const wall = new Set(b.group(wallAt).stones);
  const t = b.idx(target);
  const seen = new Set([t]), q = [t];
  while (q.length) {
    const p = q.pop();
    for (const j of b.nb[p]) if (!seen.has(j) && !wall.has(j) && (!only || only.has(j))) { seen.add(j); q.push(j); }
  }
  return [...seen];
}

const KILL = 2, KO = 1, LIVE = 0;
function makeSolver(b0, target, wallAt, extra) {
  const only = extra && extra.only ? new Set(extra.only.map(p => b0.idx(p))) : null;
  if (only) extra = null;
  const region = regionOf(b0, target, wallAt, only).concat((extra || []).map(p => b0.idx(p)));
  const t = b0.idx(target);
  const defender = b0.grid[t], attacker = 3 - defender;
  const memo = new Map();
  const path = new Set();
  let nodes = 0;
  function key(b, toMove, passes) { return b.grid.join('') + toMove + ':' + passes + ':' + b.ko + b.koColor; }
  function solve(b, toMove, passes) {
    if (b.grid[t] !== defender) return KILL;
    if (passes >= 2) return LIVE;
    const k = key(b, toMove, passes);
    if (memo.has(k)) return memo.get(k);
    const pk = b.grid.join('') + toMove;
    if (path.has(pk)) return KO;
    path.add(pk);
    nodes++;
    let best = toMove === attacker ? -1 : 9;
    const moves = region.filter(p => !b.grid[p]).concat([PASS]);
    for (const m of moves) {
      const c = b.clone();
      const r = c.play(m, toMove);
      if (!r.ok) continue;
      const v = solve(c, 3 - toMove, m === PASS ? passes + 1 : 0);
      if (toMove === attacker) { if (v > best) best = v; if (best === KILL) break; }
      else { if (v < best) best = v; if (best === LIVE) break; }
    }
    path.delete(pk);
    memo.set(k, best);
    return best;
  }
  return {
    region, defender, attacker,
    value(b, toMove) { return solve(b, toMove, 0); },
    // For a position with `toMove` to play, list each legal move and its value.
    moves(b, toMove) {
      const out = [];
      for (const m of region.filter(p => !b.grid[p]).concat([PASS])) {
        const c = b.clone(); const r = c.play(m, toMove);
        if (!r.ok) continue;
        out.push([b.name(m), solve(c, 3 - toMove, m === PASS ? 1 : 0)]);
      }
      return out;
    },
    nodes: () => nodes,
  };
}
const NAMES = ['live', 'ko', 'kill'];
function report(rows, target, wallAt, opts) {
  opts = opts || {};
  const b = Go.Board.fromRows(rows);
  const S = makeSolver(b, target, wallAt, opts.extra);
  const def = S.defender === BLACK ? 'B' : 'W', att = def === 'B' ? 'W' : 'B';
  console.log(rows.join('\n'));
  console.log(`region ${S.region.length}: ${S.region.map(i => b.name(i)).join(' ')}`);
  const am = S.moves(b, S.attacker), dm = S.moves(b, S.defender);
  console.log(`${att} (attacker) to play: ` + am.map(([m, v]) => `${m}=${NAMES[v]}`).join(' '));
  console.log(`${def} (defender) to play: ` + dm.map(([m, v]) => `${m}=${NAMES[v]}`).join(' '));
  return { b, S };
}
module.exports = { makeSolver, report, KILL, KO, LIVE, NAMES, Go };
// Plays `seq` (alternating, first colour = first) and lists the options for the side to move.
function line(rows, target, wallAt, opts, first, seq) {
  const b = Go.Board.fromRows(rows);
  const S = makeSolver(b, target, wallAt, opts && opts.extra);
  let c = first === 'B' ? BLACK : WHITE;
  for (const m of seq) { const r = b.play(m, c); if (!r.ok) throw new Error(m + ' ' + r.reason); c = 3 - c; }
  const mv = S.moves(b, c);
  console.log(`after ${seq.join(' ') || '(start)'}, ${c === BLACK ? 'B' : 'W'} to play: ` + mv.map(([m, v]) => `${m}=${NAMES[v]}`).join(' '));
  return b;
}
module.exports.line = line;
