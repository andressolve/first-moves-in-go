/*
 * Go engine for the lessons: rules, capture reading, scoring and two
 * computer opponents. No DOM code here, so it also runs under Node for tests.
 */
(function (root) {
  'use strict';

  const EMPTY = 0, BLACK = 1, WHITE = 2;
  const PASS = -1;
  const opp = c => 3 - c;
  const COLS = 'ABCDEFGHJKLMNOPQRST'; // Go skips the letter I

  const nbCache = {};
  function neighborTable(n) {
    if (nbCache[n]) return nbCache[n];
    const t = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const a = [];
      if (x > 0) a.push(y * n + x - 1);
      if (x < n - 1) a.push(y * n + x + 1);
      if (y > 0) a.push((y - 1) * n + x);
      if (y < n - 1) a.push((y + 1) * n + x);
      t.push(a);
    }
    return (nbCache[n] = t);
  }

  // "C3" <-> index. Row 1 is the bottom row, as on a real board.
  function toIdx(name, n) {
    if (typeof name === 'number') return name;
    if (!name || /^pass$/i.test(name)) return PASS;
    const x = COLS.indexOf(name[0].toUpperCase());
    const row = parseInt(name.slice(1), 10);
    if (x < 0 || x >= n || !(row >= 1 && row <= n)) throw new Error('Bad point ' + name);
    return (n - row) * n + x;
  }
  function toName(i, n) {
    if (i === PASS) return 'pass';
    return COLS[i % n] + (n - Math.floor(i / n));
  }

  class Board {
    constructor(size, grid) {
      this.size = size;
      this.grid = grid ? Uint8Array.from(grid) : new Uint8Array(size * size);
      this.nb = neighborTable(size);
      this.ko = -1;          // point the next player may not take
      this.koColor = 0;      // the colour that is barred from it
      this.prisoners = [0, 0, 0]; // prisoners[c] = stones captured BY colour c
      this.toPlay = BLACK;
      this.lastMove = null;
      this.passes = 0;
    }

    // rows top to bottom; X = black, O = white, anything else = empty.
    static fromRows(rows, toPlay) {
      const clean = rows.map(r => r.replace(/\s+/g, ''));
      const n = clean.length;
      const b = new Board(n);
      clean.forEach((r, y) => {
        if (r.length !== n) throw new Error('Row ' + y + ' has length ' + r.length + ', expected ' + n);
        for (let x = 0; x < n; x++) b.grid[y * n + x] = r[x] === 'X' ? BLACK : r[x] === 'O' ? WHITE : EMPTY;
      });
      if (toPlay) b.toPlay = toPlay;
      return b;
    }

    clone() {
      const b = new Board(this.size, this.grid);
      b.ko = this.ko; b.koColor = this.koColor;
      b.prisoners = this.prisoners.slice();
      b.toPlay = this.toPlay; b.lastMove = this.lastMove; b.passes = this.passes;
      return b;
    }

    idx(name) { return toIdx(name, this.size); }
    name(i) { return toName(i, this.size); }
    at(p) { return this.grid[toIdx(p, this.size)]; }

    group(p) {
      const i = toIdx(p, this.size);
      const c = this.grid[i];
      if (!c) return null;
      const stones = [i], seen = new Set([i]), libs = new Set();
      for (let k = 0; k < stones.length; k++) {
        for (const j of this.nb[stones[k]]) {
          const v = this.grid[j];
          if (v === EMPTY) libs.add(j);
          else if (v === c && !seen.has(j)) { seen.add(j); stones.push(j); }
        }
      }
      return { color: c, stones, libs };
    }

    groups(color) {
      const seen = new Uint8Array(this.grid.length), out = [];
      for (let i = 0; i < this.grid.length; i++) {
        if (!this.grid[i] || seen[i] || (color && this.grid[i] !== color)) continue;
        const g = this.group(i);
        g.stones.forEach(s => (seen[s] = 1));
        out.push(g);
      }
      return out;
    }

    // Plays a move and mutates the board. Returns {ok, captured, reason}.
    play(p, color) {
      color = color || this.toPlay;
      const i = toIdx(p, this.size);
      if (i === PASS) {
        this.passes++; this.ko = -1; this.lastMove = PASS; this.toPlay = opp(color);
        return { ok: true, pass: true, captured: [], color };
      }
      if (i < 0 || i >= this.grid.length) return { ok: false, reason: 'offboard' };
      if (this.grid[i] !== EMPTY) return { ok: false, reason: 'occupied' };
      if (i === this.ko && color === this.koColor) return { ok: false, reason: 'ko' };
      this.grid[i] = color;
      const captured = [];
      for (const j of this.nb[i]) {
        if (this.grid[j] !== opp(color)) continue;
        const g = this.group(j);
        if (g.libs.size === 0) for (const s of g.stones) { this.grid[s] = EMPTY; captured.push(s); }
      }
      const mine = this.group(i);
      if (mine.libs.size === 0) { this.grid[i] = EMPTY; return { ok: false, reason: 'suicide' }; }
      this.ko = -1; this.koColor = 0;
      if (captured.length === 1 && mine.stones.length === 1 && mine.libs.size === 1) {
        this.ko = captured[0]; this.koColor = opp(color);
      }
      this.prisoners[color] += captured.length;
      this.lastMove = i; this.passes = 0; this.toPlay = opp(color);
      return { ok: true, captured, move: i, color };
    }

    tryPlay(p, color) {
      const b = this.clone();
      const r = b.play(p, color);
      return r.ok ? { board: b, result: r } : { board: null, result: r };
    }

    isLegal(p, color) { return this.clone().play(p, color).ok; }

    legalMoves(color) {
      const out = [];
      for (let i = 0; i < this.grid.length; i++) if (!this.grid[i] && this.isLegal(i, color)) out.push(i);
      return out;
    }

    toRows() {
      const n = this.size, rows = [];
      for (let y = 0; y < n; y++) {
        let r = '';
        for (let x = 0; x < n; x++) r += '.XO'[this.grid[y * n + x]];
        rows.push(r);
      }
      return rows;
    }
  }

  /* ---------- Capture reading (ladders, nets, simple races) ---------- */

  // Returns the attacker's first move that captures the group at p, or null
  // if the group can escape. Attacker is the colour opposite the group, and
  // it is the attacker's turn. Works for groups with 1 or 2 liberties.
  function attack(board, p, depth, budget) {
    budget = budget || { n: 30000 };
    depth = depth == null ? 40 : depth;
    const s = toIdx(p, board.size);
    const g = board.group(s);
    if (!g) return PASS; // already gone
    const att = opp(g.color);
    if (--budget.n < 0) return null;
    if (g.libs.size === 1) {
      const L = [...g.libs][0];
      return board.clone().play(L, att).ok ? L : null;
    }
    if (g.libs.size > 2 || depth <= 0) return null;
    // Try the liberty that leaves the defender fewest escape routes first.
    const libs = [...g.libs];
    for (const L of libs) {
      const b = board.clone();
      if (!b.play(L, att).ok) continue;
      if (!defend(b, s, depth - 1, budget)) return L;
    }
    return null;
  }

  // Defender to move. True if the group at p can be made safe.
  function defend(board, p, depth, budget) {
    budget = budget || { n: 30000 };
    depth = depth == null ? 40 : depth;
    const s = toIdx(p, board.size);
    const g = board.group(s);
    if (!g) return false;
    if (g.libs.size >= 3) return true;
    if (--budget.n < 0) return true; // give up reading: assume it lives
    for (const c of defenseMoves(board, g)) {
      const b = board.clone();
      if (!b.play(c, g.color).ok) continue;
      const g2 = b.group(s);
      if (!g2) continue;
      if (g2.libs.size >= 3) return true;
      if (g2.libs.size === 2 && attack(b, s, depth - 1, budget) === null) return true;
    }
    // With two liberties the defender may also ignore the threat.
    if (g.libs.size === 2) {
      const b = board.clone(); b.ko = -1; b.toPlay = opp(g.color);
      if (attack(b, s, depth - 1, budget) === null) return true;
    }
    return false;
  }

  // Candidate defending moves: extend at a liberty, or capture an adjacent
  // attacking group that is itself short of liberties.
  function defenseMoves(board, g) {
    const out = new Set(g.libs);
    const seen = new Set();
    for (const s of g.stones) for (const j of board.nb[s]) {
      if (board.grid[j] !== opp(g.color) || seen.has(j)) continue;
      const ag = board.group(j);
      ag.stones.forEach(x => seen.add(x));
      if (ag.libs.size === 1) ag.libs.forEach(l => out.add(l));
    }
    return [...out];
  }

  // The defender's most stubborn reply in a losing position (used by puzzles).
  function bestResistance(board, p) {
    const s = toIdx(p, board.size);
    const g = board.group(s);
    if (!g) return null;
    let best = null, bestScore = -1;
    for (const c of defenseMoves(board, g)) {
      const b = board.clone();
      if (!b.play(c, g.color).ok) continue;
      const g2 = b.group(s);
      if (!g2) continue;
      let score = g2.libs.size * 10 + g2.stones.length;
      if (g2.libs.size >= 2 && attack(b, s) === null) score += 1000;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  /* ---------- Scoring ---------- */

  // Area scoring (Chinese): stones on the board + empty points they surround.
  function scoreArea(board, dead, komi) {
    dead = dead || new Set(); komi = komi || 0;
    const n = board.size, N = n * n, g = Uint8Array.from(board.grid);
    let deadBlack = 0, deadWhite = 0;
    for (const d of dead) { if (g[d] === BLACK) deadBlack++; else if (g[d] === WHITE) deadWhite++; g[d] = EMPTY; }
    const owner = new Uint8Array(N), seen = new Uint8Array(N), nb = board.nb;
    for (let i = 0; i < N; i++) {
      if (g[i]) { owner[i] = g[i]; continue; }
      if (seen[i]) continue;
      const region = [i], borders = new Set();
      seen[i] = 1;
      for (let k = 0; k < region.length; k++) for (const j of nb[region[k]]) {
        if (g[j]) borders.add(g[j]);
        else if (!seen[j]) { seen[j] = 1; region.push(j); }
      }
      const o = borders.size === 1 ? [...borders][0] : 0;
      for (const r of region) owner[r] = o;
    }
    const res = { owner, blackStones: 0, whiteStones: 0, blackTerritory: 0, whiteTerritory: 0, deadBlack, deadWhite, komi };
    for (let i = 0; i < N; i++) {
      if (g[i] === BLACK) res.blackStones++;
      else if (g[i] === WHITE) res.whiteStones++;
      else if (owner[i] === BLACK) res.blackTerritory++;
      else if (owner[i] === WHITE) res.whiteTerritory++;
    }
    res.black = res.blackStones + res.blackTerritory;
    res.white = res.whiteStones + res.whiteTerritory + komi;
    res.winner = res.black > res.white ? BLACK : res.white > res.black ? WHITE : 0;
    res.margin = Math.abs(res.black - res.white);
    return res;
  }

  // Territory scoring (Japanese): surrounded empty points + prisoners.
  function scoreTerritory(board, dead, komi) {
    const a = scoreArea(board, dead, komi);
    const black = a.blackTerritory + board.prisoners[BLACK] + a.deadWhite;
    const white = a.whiteTerritory + board.prisoners[WHITE] + a.deadBlack + (komi || 0);
    return {
      black, white, owner: a.owner, komi: komi || 0,
      blackTerritory: a.blackTerritory, whiteTerritory: a.whiteTerritory,
      blackPrisoners: board.prisoners[BLACK] + a.deadWhite,
      whitePrisoners: board.prisoners[WHITE] + a.deadBlack,
      winner: black > white ? BLACK : white > black ? WHITE : 0,
      margin: Math.abs(black - white),
    };
  }

  /* ---------- Capture-Go opponent (first capture wins) ---------- */

  function captureBotMove(board, color, level) {
    level = level == null ? 1 : level;
    const moves = board.legalMoves(color);
    if (!moves.length) return PASS;
    const n = board.size, mid = (n - 1) / 2;
    const noise = [90, 18, 4][level];
    const blunder = level === 0 && Math.random() < 0.3;
    let best = PASS, bestScore = -Infinity;
    for (const m of moves) {
      const b = board.clone();
      const r = b.play(m, color);
      let score = 0;
      if (r.captured.length) score = 1e6 + r.captured.length;
      else {
        for (const g of b.groups(color)) {
          if (g.libs.size === 1 && !blunder) score -= 1e5;
          else if (g.libs.size === 2 && level >= 1 && attack(b, g.stones[0], 24, { n: 3000 }) !== null) score -= 5e4;
          score += Math.min(g.libs.size, 5) * 3;
        }
        for (const g of b.groups(opp(color))) {
          if (g.libs.size === 1) {
            const bb = b.clone();
            score += (level >= 1 && !defend(bb, g.stones[0], 24, { n: 3000 })) ? 2e4 : 25;
          } else if (g.libs.size === 2 && level >= 2) {
            const bb = b.clone(); bb.toPlay = color;
            if (attack(bb, g.stones[0], 24, { n: 3000 }) !== null) score += 60;
          }
          score -= Math.min(g.libs.size, 5) * 4;
        }
        const [x, y] = [m % n, Math.floor(m / n)];
        score -= (Math.abs(x - mid) + Math.abs(y - mid)) * 0.8;
        // Prefer contact with the opponent.
        if (board.nb[m].some(j => board.grid[j] === opp(color))) score += 6;
      }
      score += Math.random() * noise;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  /* ---------- Monte Carlo opponent for full games ---------- */

  // A fast padded board used only inside random playouts.
  class Fast {
    constructor(n) {
      this.n = n; this.W = n + 2;
      this.c = new Uint8Array(this.W * this.W).fill(3);
      this.dirs = [1, -1, this.W, -this.W];
      this.diag = [this.W + 1, this.W - 1, -this.W + 1, -this.W - 1];
      this.mark = new Uint32Array(this.W * this.W); this.stamp = 1;
      this.stack = new Int32Array(this.W * this.W);
      this.points = [];
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.points.push((y + 1) * this.W + x + 1);
      this.ko = -1;
    }
    load(board) {
      const n = this.n;
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) this.c[(y + 1) * this.W + x + 1] = board.grid[y * n + x];
      this.ko = board.ko >= 0 ? this.toF(board.ko) : -1;
    }
    copyFrom(f) { this.c.set(f.c); this.ko = f.ko; }
    toF(i) { return (Math.floor(i / this.n) + 1) * this.W + (i % this.n) + 1; }
    toB(p) { return (Math.floor(p / this.W) - 1) * this.n + (p % this.W) - 1; }
    // Liberties of the group at p, counting at most `limit`; returns count and
    // stores the last liberty seen in this.lastLib.
    libs(p, limit) {
      const col = this.c[p], st = this.stack, mk = this.mark;
      const s = ++this.stamp; let sp = 0, count = 0;
      st[sp++] = p; mk[p] = s;
      while (sp) {
        const q = st[--sp];
        for (let d = 0; d < 4; d++) {
          const r = q + this.dirs[d];
          if (mk[r] === s) continue;
          const v = this.c[r];
          if (v === 0) { mk[r] = s; count++; this.lastLib = r; if (count >= limit) return count; }
          else if (v === col) { mk[r] = s; st[sp++] = r; }
        }
      }
      return count;
    }
    remove(p) {
      const col = this.c[p], st = this.stack; let sp = 0, k = 0;
      st[sp++] = p; this.c[p] = 0;
      while (sp) {
        const q = st[--sp]; k++;
        for (let d = 0; d < 4; d++) { const r = q + this.dirs[d]; if (this.c[r] === col) { this.c[r] = 0; st[sp++] = r; } }
      }
      return k;
    }
    isEyeish(p, col) {
      for (let d = 0; d < 4; d++) { const v = this.c[p + this.dirs[d]]; if (v !== col && v !== 3) return false; }
      let bad = 0, edge = 0;
      for (let d = 0; d < 4; d++) { const v = this.c[p + this.diag[d]]; if (v === 3) edge = 1; else if (v === 3 - col) bad++; }
      return bad + edge < 2;
    }
    // Returns true if the move was played.
    play(p, col) {
      if (this.c[p] !== 0 || p === this.ko) return false;
      this.c[p] = col;
      const o = 3 - col; let caps = 0, capAt = -1;
      for (let d = 0; d < 4; d++) {
        const r = p + this.dirs[d];
        if (this.c[r] === o && this.libs(r, 1) === 0) { caps += this.remove(r); capAt = r; }
      }
      if (caps === 0 && this.libs(p, 1) === 0) { this.c[p] = 0; return false; }
      this.ko = -1;
      if (caps === 1) {
        let alone = true;
        for (let d = 0; d < 4; d++) if (this.c[p + this.dirs[d]] === col) alone = false;
        if (alone && this.libs(p, 2) === 1) this.ko = capAt;
      }
      return true;
    }
  }

  function playout(f, toPlay, maxMoves, last) {
    const pts = f.points, P = pts.length;
    let passes = 0, col = toPlay;
    for (let m = 0; m < maxMoves && passes < 2; m++) {
      let played = -1;
      // Tactical reflexes: answer an atari, or capture a group in atari, next to the last move.
      if (last > 0) {
        for (let d = 0; d < 4 && played < 0; d++) {
          const r = last + f.dirs[d], v = f.c[r];
          if (v === col && f.libs(r, 2) === 1) {
            const L = f.lastLib;
            if (!f.isEyeish(L, col) && f.play(L, col)) {
              if (f.libs(L, 2) >= 2) played = L; // escaped (or not; it's a reflex)
              else played = L;
            }
          } else if (v === 3 - col && f.libs(r, 2) === 1) {
            const L = f.lastLib;
            if (f.play(L, col)) played = L;
          }
        }
        if (played < 0 && f.c[last] === 3 - col && f.libs(last, 2) === 1) {
          const L = f.lastLib; if (f.play(L, col)) played = L;
        }
      }
      if (played < 0) {
        let start = (Math.random() * P) | 0;
        for (let k = 0; k < P; k++) {
          const p = pts[(start + k) % P];
          if (f.c[p] !== 0 || f.isEyeish(p, col)) continue;
          if (f.play(p, col)) { played = p; break; }
        }
      }
      if (played < 0) passes++; else passes = 0;
      last = played;
      col = 3 - col;
    }
  }

  // Ownership of each point after a finished playout: 1 black, 2 white, 0 none.
  function finalOwner(f, out) {
    const pts = f.points;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], v = f.c[p];
      if (v === 1 || v === 2) { out[k] = v; continue; }
      let b = 0, w = 0;
      for (let d = 0; d < 4; d++) { const q = f.c[p + f.dirs[d]]; if (q === 1) b++; else if (q === 2) w++; }
      out[k] = b && !w ? 1 : w && !b ? 2 : 0;
    }
  }

  // Runs playouts from a position and reports ownership (+1 black .. -1 white)
  // and the share of playouts each colour won.
  function estimate(board, toPlay, playouts, komi) {
    const n = board.size, N = n * n;
    const root = new Fast(n); root.load(board);
    const f = new Fast(n), own = new Float64Array(N), tmp = new Uint8Array(N);
    let blackWins = 0;
    for (let t = 0; t < playouts; t++) {
      f.copyFrom(root);
      playout(f, t % 2 ? opp(toPlay) : toPlay, N * 3, -1);
      finalOwner(f, tmp);
      let s = -komi;
      for (let i = 0; i < N; i++) { if (tmp[i] === 1) { own[i] += 1; s++; } else if (tmp[i] === 2) { own[i] -= 1; s--; } }
      if (s > 0) blackWins++;
    }
    for (let i = 0; i < N; i++) own[i] /= playouts;
    return { ownership: own, blackWinRate: blackWins / playouts };
  }

  // Which stones look dead at the end of a game? Returns a Set of indices.
  function guessDead(board, komi, playouts) {
    const { ownership } = estimate(board, BLACK, playouts || 800, komi || 0);
    const dead = new Set();
    for (const g of board.groups()) {
      let sum = 0;
      for (const s of g.stones) sum += ownership[s];
      const avg = sum / g.stones.length;
      if ((g.color === BLACK && avg < -0.3) || (g.color === WHITE && avg > 0.3)) g.stones.forEach(s => dead.add(s));
    }
    return dead;
  }

  // Flat Monte Carlo search with UCB at the root. Async so the page stays
  // responsive. Returns {move, winRate, ownership}.
  async function mcMove(board, color, opts) {
    opts = opts || {};
    const playouts = opts.playouts || 2000, komi = opts.komi == null ? 7.5 : opts.komi;
    const n = board.size, N = n * n;
    const root = new Fast(n); root.load(board);
    const cands = [];
    for (let i = 0; i < N; i++) {
      if (board.grid[i]) continue;
      const p = root.toF(i);
      if (root.isEyeish(p, color)) continue;
      if (!board.isLegal(i, color)) continue;
      // Skip first-line moves with nothing nearby: they are almost never right.
      const x = i % n, y = Math.floor(i / n);
      if (x === 0 || y === 0 || x === n - 1 || y === n - 1) {
        let near = false;
        for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (Math.abs(dx) + Math.abs(dy) <= 2 && xx >= 0 && yy >= 0 && xx < n && yy < n && board.grid[yy * n + xx]) { near = true; break; }
        }
        if (!near) continue;
      }
      cands.push({ i, p, w: 0, v: 0 });
    }
    if (!cands.length) return { move: PASS, winRate: 0.5 };
    const own = new Float64Array(N), tmp = new Uint8Array(N), f = new Fast(n);
    let total = 0;
    for (let t = 0; t < playouts; t++) {
      let c;
      if (t < cands.length) c = cands[t];
      else {
        let bestU = -1;
        const lt = Math.log(total + 1);
        for (const k of cands) {
          const u = k.w / k.v + 0.6 * Math.sqrt(lt / k.v);
          if (u > bestU) { bestU = u; c = k; }
        }
      }
      f.copyFrom(root);
      f.play(c.p, color);
      playout(f, opp(color), N * 3, c.p);
      finalOwner(f, tmp);
      let s = -komi;
      for (let i = 0; i < N; i++) { if (tmp[i] === 1) { own[i] += 1; s++; } else if (tmp[i] === 2) { own[i] -= 1; s--; } }
      const won = color === BLACK ? s > 0 : s < 0;
      c.v++; if (won) c.w++; total++;
      if (opts.yieldEvery && t % opts.yieldEvery === opts.yieldEvery - 1) await new Promise(r => setTimeout(r, 0));
    }
    for (let i = 0; i < N; i++) own[i] /= total;
    // Before passing, fill any neutral point (one touching both colours):
    // under area scoring it is worth a point.
    const neutral = () => {
      for (const k of cands) {
        let b = false, w = false;
        for (const j of board.nb[k.i]) { if (board.grid[j] === BLACK) b = true; else if (board.grid[j] === WHITE) w = true; }
        if (b && w && board.clone().play(k.i, color).ok) {
          const after = board.clone(); after.play(k.i, color);
          if (after.group(k.i).libs.size >= 2) return k.i;
        }
      }
      return null;
    };
    // Only consider moves on points that are still undecided.
    const sign = color === BLACK ? 1 : -1;
    const open = cands.filter(k => Math.abs(own[k.i]) < 0.7 || k.v > total / 8);
    const pool = open.length ? open : [];
    let best = null;
    for (const k of pool) if (!best || k.v > best.v) best = k;
    if (!best) { const d = neutral(); return { move: d == null ? PASS : d, winRate: 0.5, ownership: own }; }
    // Pass if every remaining empty point is already settled.
    let unsettled = 0;
    for (let i = 0; i < N; i++) if (!board.grid[i] && Math.abs(own[i]) < 0.6) unsettled++;
    const wantsPass = unsettled === 0 && (board.passes > 0 || (Math.abs(own[best.i]) > 0.8 && sign * own[best.i] > 0));
    if (wantsPass) {
      const d = neutral();
      return { move: d == null ? PASS : d, winRate: best.w / best.v, ownership: own };
    }
    return { move: best.i, winRate: best.w / best.v, ownership: own };
  }

  const Go = {
    EMPTY, BLACK, WHITE, PASS, COLS, opp,
    Board, toIdx, toName,
    attack, defend, bestResistance, defenseMoves,
    scoreArea, scoreTerritory,
    captureBotMove, mcMove, estimate, guessDead,
    colorName: c => (c === BLACK ? 'Black' : c === WHITE ? 'White' : 'Nobody'),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Go;
  else root.Go = Object.assign(root.Go || {}, Go);
})(typeof window !== 'undefined' ? window : globalThis);
