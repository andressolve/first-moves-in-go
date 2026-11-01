const Go = require('../src/go-engine.js');
const { Board } = Go;
const base = [
 '.........','.........','.........','....X....',
 '...XO....','.....X...','.........','.........','.........'];
const run = (rows,label) => { const b = Board.fromRows(rows); const a = Go.attack(b,'E5'); console.log(label, a == null ? 'escapes' : 'captured, first move ' + Go.toName(a,9)); };
run(base,'no breaker:');
let r = base.slice(); r[1] = '.......O.'; run(r,'white at H8 (path up-right):');
r = base.slice(); r[7] = '.O.......'; run(r,'white at B2 (other side):');
