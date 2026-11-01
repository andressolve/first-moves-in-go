const Go = require('../src/go-engine.js');
const assert = require('assert');
const { Board, BLACK: B, WHITE: W } = Go;

// capture a single stone
let b = Board.fromRows(['.....','..X..','.XO..','..X..','.....']);
let r = b.play('D3', B); assert(r.ok && r.captured.length === 1, 'capture');
// suicide
b = Board.fromRows(['.X...','X....','.....','.....','.....']);
assert.equal(b.play('A5', W).reason, 'suicide');
// ko
b = Board.fromRows(['.....','.XO..','X.XO.','.XO..','.....']);
r = b.play('B3', W); assert(r.ok && r.captured.length === 1, 'ko take');
assert.equal(b.play('C3', B).reason, 'ko');
b.play('E5', B); b.play('E1', W);
assert(b.play('C3', B).ok, 'retake after threat');
// ladder: works with nothing in the way
b = Board.fromRows([
 '.........','.........','.........','.........','.........',
 '...XO....','...OX....','....X....','.........']);
// white stone at E4 (row 4? ) -- find white stones in atari
const wg = b.groups(W);
console.log('white groups libs', wg.map(g => g.stones.map(s=>b.name(s)) + ':' + g.libs.size));
// classic: white stone in atari-able position with 2 libs
b = Board.fromRows([
 '.........','.........','.........','.........',
 '....X....','...XO....','....X....','.........','.........']);
console.log('attack white E4 ->', b.name(Go.attack(b, 'E4') ?? -1));
// Ladder breaker at top right: white stone at H8
b = Board.fromRows([
 '.........','.......O.','.........','.........',
 '....X....','...XO....','....X....','.........','.........']);
console.log('with breaker ->', Go.attack(b, 'E4'));
// scoring
b = Board.fromRows(['..X.O','..X.O','..X.O','..X.O','..X.O']);
const s = Go.scoreArea(b, new Set(), 0);
console.log('area', s.black, s.white);
// bot speed
let t = Date.now();
b = new Board(7);
for (let i=0;i<10;i++){ const m = Go.captureBotMove(b, b.toPlay, 2); b.play(m); }
console.log('capturebot 10 moves', Date.now()-t, 'ms'); console.log(b.toRows().join('\n'));
(async()=>{
 t = Date.now(); b = new Board(9);
 const res = await Go.mcMove(b, B, {playouts: 3000});
 console.log('mc 3000 playouts', Date.now()-t,'ms move', b.name(res.move), res.winRate.toFixed(2));
 // self play a short game to check passing ends
 b = new Board(9); let moves=0;
 t=Date.now();
 while (b.passes < 2 && moves < 200) { const r = await Go.mcMove(b, b.toPlay, {playouts: 600}); b.play(r.move); moves++; }
 console.log('selfplay moves', moves, Date.now()-t,'ms'); console.log(b.toRows().join('\n'));
 const dead = Go.guessDead(b, 7.5); const sc = Go.scoreArea(b, dead, 7.5); console.log('dead', dead.size, 'score B', sc.black, 'W', sc.white);
})();
