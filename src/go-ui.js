/*
 * Board view and interactive lesson widgets. Depends on go-engine.js.
 */
(function () {
  'use strict';
  const Go = window.Go;
  const { Board, BLACK, WHITE, EMPTY, PASS, opp } = Go;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let uid = 0;

  function svg(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) if (kid != null) e.append(kid);
    return e;
  }
  const $ = s => (typeof s === 'string' ? document.querySelector(s) : s);
  const wait = ms => new Promise(r => setTimeout(r, reduceMotion ? Math.min(ms, 60) : ms));
  const colorOf = c => (c === 'B' || c === 'black' || c === BLACK ? BLACK : c === 'W' || c === 'white' || c === WHITE ? WHITE : null);

  function makeBoard(spec) {
    if (spec.board) return spec.board.clone();
    const b = spec.setup ? Board.fromRows(spec.setup) : new Board(spec.size || 9);
    if (spec.toPlay) b.toPlay = colorOf(spec.toPlay) || b.toPlay;
    return b;
  }

  /* ---------------- Board view ---------------- */

  const STAR = {
    5: [[2, 2]], 7: [[3, 3]],
    9: [[2, 2], [6, 2], [2, 6], [6, 6], [4, 4]], 13: [[3, 3], [9, 3], [3, 9], [9, 9], [6, 6]],
    19: [[3, 3], [9, 3], [15, 3], [3, 9], [9, 9], [15, 9], [3, 15], [9, 15], [15, 15]],
  };

  class BoardView {
    constructor(host, opts) {
      opts = opts || {};
      this.n = opts.size;
      this.coords = opts.coords !== false;
      this.onClick = null;
      this.hoverColor = null;
      this.interactive = false;
      this.stones = new Map();
      this.prev = new Uint8Array(this.n * this.n);
      const n = this.n, m = this.coords ? 1.05 : 0.62, W = n - 1 + 2 * m;
      const id = 'gb' + ++uid;
      this.id = id;
      const root = svg('svg', { viewBox: `${-m} ${-m} ${W} ${W}`, class: 'goban', role: 'img', tabindex: '0' });
      root.setAttribute('aria-label', `${n} by ${n} Go board`);
      const defs = svg('defs', {}, root);
      const gb = svg('radialGradient', { id: id + 'b', cx: '35%', cy: '30%', r: '70%' }, defs);
      svg('stop', { offset: '0', 'stop-color': '#6b6f76' }, gb);
      svg('stop', { offset: '0.45', 'stop-color': '#232528' }, gb);
      svg('stop', { offset: '1', 'stop-color': '#08090a' }, gb);
      const gw = svg('radialGradient', { id: id + 'w', cx: '35%', cy: '30%', r: '75%' }, defs);
      svg('stop', { offset: '0', 'stop-color': '#ffffff' }, gw);
      svg('stop', { offset: '0.6', 'stop-color': '#efede6' }, gw);
      svg('stop', { offset: '1', 'stop-color': '#c4c0b4' }, gw);
      const wood = svg('linearGradient', { id: id + 'k', x1: '0', y1: '0', x2: '1', y2: '1' }, defs);
      svg('stop', { offset: '0', style: 'stop-color: var(--kaya-hi)' }, wood);
      svg('stop', { offset: '1', style: 'stop-color: var(--kaya)' }, wood);
      const grain = svg('filter', { id: id + 'g', x: '0', y: '0', width: '100%', height: '100%' }, defs);
      svg('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035 0.6', numOctaves: '2', seed: String(uid * 7) }, grain);
      svg('feColorMatrix', { values: '0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.05  0 0 0 0.55 0' }, grain);

      svg('rect', { x: -m, y: -m, width: W, height: W, rx: 0.14, fill: `url(#${id}k)` }, root);
      svg('rect', { x: -m, y: -m, width: W, height: W, rx: 0.14, filter: `url(#${id}g)`, opacity: '0.28' }, root);
      const grid = svg('g', { class: 'grid' }, root);
      for (let k = 0; k < n; k++) {
        const edge = k === 0 || k === n - 1;
        svg('line', { x1: 0, y1: k, x2: n - 1, y2: k, 'stroke-width': edge ? 0.045 : 0.028 }, grid);
        svg('line', { x1: k, y1: 0, x2: k, y2: n - 1, 'stroke-width': edge ? 0.045 : 0.028 }, grid);
      }
      for (const [x, y] of STAR[n] || []) svg('circle', { cx: x, cy: y, r: 0.09, class: 'star' }, grid);
      if (this.coords) {
        const cg = svg('g', { class: 'coords' }, root);
        for (let k = 0; k < n; k++) {
          const t1 = svg('text', { x: k, y: n - 1 + m * 0.62, 'text-anchor': 'middle', 'dominant-baseline': 'middle' }, cg);
          t1.textContent = Go.COLS[k];
          const t2 = svg('text', { x: -m * 0.6, y: k, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, cg);
          t2.textContent = String(n - k);
        }
      }
      this.gUnder = svg('g', {}, root);
      this.gStones = svg('g', {}, root);
      this.gMarks = svg('g', { class: 'marks' }, root);
      this.gHover = svg('g', { class: 'hover' }, root);
      this.root = root;
      this.cursor = Math.floor(n * n / 2);
      this.cursorOn = false;
      host.appendChild(root);

      const pt = evt => {
        const p = root.createSVGPoint(); p.x = evt.clientX; p.y = evt.clientY;
        const q = p.matrixTransform(root.getScreenCTM().inverse());
        const x = Math.round(q.x), y = Math.round(q.y);
        if (x < 0 || y < 0 || x >= n || y >= n) return -1;
        if (Math.hypot(q.x - x, q.y - y) > 0.62) return -1;
        return y * n + x;
      };
      root.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.showHover(pt(e)); });
      root.addEventListener('pointerleave', () => this.showHover(-1));
      root.addEventListener('click', e => {
        const i = pt(e);
        this.cursorOn = false; this.drawCursor();
        if (i >= 0 && this.interactive && this.onClick) this.onClick(i);
      });
      root.addEventListener('keydown', e => {
        const k = e.key;
        let { cursor: c } = this;
        if (k === 'ArrowLeft' && c % n > 0) c--;
        else if (k === 'ArrowRight' && c % n < n - 1) c++;
        else if (k === 'ArrowUp' && c >= n) c -= n;
        else if (k === 'ArrowDown' && c < n * (n - 1)) c += n;
        else if ((k === 'Enter' || k === ' ') && this.interactive && this.onClick) { e.preventDefault(); this.onClick(c); return; }
        else return;
        e.preventDefault();
        this.cursor = c; this.cursorOn = true; this.drawCursor(); this.showHover(c);
      });
      root.addEventListener('blur', () => { this.cursorOn = false; this.drawCursor(); });
    }

    drawCursor() {
      if (this.cursorEl) this.cursorEl.remove();
      this.cursorEl = null;
      if (!this.cursorOn) return;
      const x = this.cursor % this.n, y = Math.floor(this.cursor / this.n);
      this.cursorEl = svg('rect', { x: x - 0.5, y: y - 0.5, width: 1, height: 1, class: 'kbd-cursor' }, this.gHover);
    }

    showHover(i) {
      if (this.hoverEl) { this.hoverEl.remove(); this.hoverEl = null; }
      if (i < 0 || !this.interactive || !this.hoverColor || !this.board || this.board.grid[i]) return;
      const x = i % this.n, y = Math.floor(i / this.n);
      this.hoverEl = this.stoneEl(x, y, this.hoverColor, this.gHover);
      this.hoverEl.classList.add('ghost');
    }

    stoneEl(x, y, c, parent) {
      const g = svg('g', { transform: `translate(${x} ${y})`, class: 'stone ' + (c === BLACK ? 'b' : 'w') }, parent);
      const inner = svg('g', { class: 'inner' }, g);
      svg('circle', { cx: 0.045, cy: 0.07, r: 0.47, class: 'shadow' }, inner);
      svg('circle', { r: 0.475, fill: `url(#${this.id}${c === BLACK ? 'b' : 'w'})`, class: 'body' }, inner);
      return g;
    }

    // Draws the board, animating stones that appeared or disappeared.
    set(board, animate) {
      this.board = board;
      const n = this.n;
      for (let i = 0; i < n * n; i++) {
        const now = board.grid[i], was = this.prev[i];
        if (now === was) continue;
        const old = this.stones.get(i);
        if (old) {
          this.stones.delete(i);
          if (animate && !reduceMotion) { old.classList.add('leaving'); setTimeout(() => old.remove(), 520); }
          else old.remove();
        }
        if (now) {
          const e = this.stoneEl(i % n, Math.floor(i / n), now, this.gStones);
          if (animate && !reduceMotion) e.classList.add('arriving');
          this.stones.set(i, e);
        }
      }
      this.prev = Uint8Array.from(board.grid);
      this.showHover(-1);
    }

    // marks: [{at, type, color?, text?}]. Types: lib, ring, tri, circ, sq,
    // x, label, terr, dead, last, dot, pick.
    mark(marks) {
      this.gMarks.textContent = '';
      this.gUnder.textContent = '';
      for (const s of this.stones.values()) s.classList.remove('dead');
      const n = this.n;
      for (const mk of marks || []) {
        const i = typeof mk.at === 'number' ? mk.at : Go.toIdx(mk.at, n);
        if (i < 0) continue;
        const x = i % n, y = Math.floor(i / n);
        const onStone = this.board && this.board.grid[i];
        const fg = onStone === BLACK ? 'on-b' : onStone === WHITE ? 'on-w' : 'on-e';
        const cls = (mk.tone ? 'tone-' + mk.tone + ' ' : '') + fg;
        const g = this.gMarks;
        switch (mk.type) {
          case 'lib': svg('circle', { cx: x, cy: y, r: 0.17, class: 'm-lib ' + cls }, g); break;
          case 'pick': svg('circle', { cx: x, cy: y, r: 0.2, class: 'm-pick ' + cls }, g); break;
          case 'dot': svg('circle', { cx: x, cy: y, r: 0.12, class: 'm-dot ' + cls }, g); break;
          case 'ring': svg('circle', { cx: x, cy: y, r: 0.53, class: 'm-ring ' + cls }, g); break;
          case 'last': svg('circle', { cx: x, cy: y, r: 0.2, class: 'm-last ' + cls }, g); break;
          case 'circ': svg('circle', { cx: x, cy: y, r: 0.24, class: 'm-shape ' + cls }, g); break;
          case 'sq': svg('rect', { x: x - 0.21, y: y - 0.21, width: 0.42, height: 0.42, class: 'm-shape ' + cls }, g); break;
          case 'tri': svg('path', { d: `M${x} ${y - 0.27} L${x + 0.25} ${y + 0.17} L${x - 0.25} ${y + 0.17} Z`, class: 'm-shape ' + cls }, g); break;
          case 'x': svg('path', { d: `M${x - 0.2} ${y - 0.2} L${x + 0.2} ${y + 0.2} M${x + 0.2} ${y - 0.2} L${x - 0.2} ${y + 0.2}`, class: 'm-x ' + cls }, g); break;
          case 'terr': svg('rect', { x: x - 0.17, y: y - 0.17, width: 0.34, height: 0.34, class: 'm-terr ' + (colorOf(mk.color) === BLACK ? 'tb' : 'tw') }, this.gUnder); break;
          case 'shade': svg('rect', { x: x - 0.5, y: y - 0.5, width: 1, height: 1, class: 'm-shade ' + (colorOf(mk.color) === BLACK ? 'tb' : 'tw'), opacity: mk.alpha == null ? 0.5 : mk.alpha }, this.gUnder); break;
          case 'dead': { const s = this.stones.get(i); if (s) s.classList.add('dead'); break; }
          case 'label': {
            if (!onStone) svg('circle', { cx: x, cy: y, r: 0.3, class: 'm-labelbg' }, g);
            const t = svg('text', { x, y, class: 'm-label ' + cls, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g);
            t.textContent = mk.text; break;
          }
        }
      }
    }
  }

  /* ---------------- Progress tracking ---------------- */

  const progress = {
    key: null, ids: new Set(), done: new Set(), listeners: [],
    init(lessonId) {
      this.key = 'go-first-moves:' + lessonId;
      try { JSON.parse(localStorage.getItem(this.key) || '[]').forEach(x => this.done.add(x)); } catch (e) { /* storage unavailable */ }
    },
    register(id) { if (id) { this.ids.add(id); this.emit(); } },
    isDone(id) { return this.done.has(id); },
    complete(id) {
      if (!id || this.done.has(id)) return;
      this.done.add(id);
      try { localStorage.setItem(this.key, JSON.stringify([...this.done])); } catch (e) { /* ignore */ }
      this.emit();
    },
    reset() {
      this.done.clear();
      try { localStorage.removeItem(this.key); } catch (e) { /* ignore */ }
      this.emit();
    },
    count() { let k = 0; for (const id of this.ids) if (this.done.has(id)) k++; return [k, this.ids.size]; },
    on(fn) { this.listeners.push(fn); fn(...this.count()); },
    emit() { const c = this.count(); this.listeners.forEach(fn => fn(...c)); },
  };

  /* ---------------- Widget shell ---------------- */

  function shell(host, spec, size) {
    host = $(host);
    host.classList.add('widget');
    if (spec.wide) host.classList.add('wide');
    const boardBox = h('div', { class: 'w-board' });
    const side = h('div', { class: 'w-side' });
    const title = spec.title ? h('p', { class: 'w-title' }, spec.title) : null;
    const prompt = h('div', { class: 'w-prompt', html: spec.prompt || '' });
    const status = h('div', { class: 'w-status', 'aria-live': 'polite' });
    const controls = h('div', { class: 'w-controls' });
    side.append(...[title, prompt, status, controls].filter(Boolean));
    host.append(boardBox, side);
    const view = new BoardView(boardBox, { size, coords: spec.coords });
    const badge = spec.checkpoint ? h('span', { class: 'w-badge', title: 'Completed' }, 'Done') : null;
    if (badge) {
      progress.register(spec.checkpoint);
      host.prepend(badge);
      const sync = () => badge.classList.toggle('on', progress.isDone(spec.checkpoint));
      progress.listeners.push(sync); sync();
    }
    return {
      host, view, side, prompt, status, controls,
      say(html, tone) { status.className = 'w-status' + (tone ? ' ' + tone : ''); status.innerHTML = html || ''; },
      button(label, fn, cls) { const b = h('button', { class: 'btn ' + (cls || ''), type: 'button', onclick: fn }, label); controls.append(b); return b; },
      complete() { if (spec.checkpoint) progress.complete(spec.checkpoint); },
    };
  }

  const ILLEGAL = {
    occupied: 'That point already has a stone on it.',
    suicide: 'You can’t play there: the stone would have no liberties, and it would not capture anything to make room.',
    ko: 'Ko rule: you can’t retake the ko right away. Play a move somewhere else first, then you may take it back.',
  };

  function libMarks(board, which) {
    const out = [];
    const groups = which ? [board.group(which)].filter(Boolean) : board.groups();
    const seen = new Set();
    for (const g of groups) for (const l of g.libs) if (!seen.has(l)) { seen.add(l); out.push({ at: l, type: 'lib' }); }
    return out;
  }
  function atariMarks(board) {
    const out = [];
    for (const g of board.groups()) {
      if (g.libs.size === 1) g.stones.forEach(s => out.push({ at: s, type: 'ring', tone: 'danger' }));
      else if (g.libs.size === 2) g.stones.forEach(s => out.push({ at: s, type: 'ring', tone: 'warn' }));
    }
    return out;
  }
  function libCountLabels(board) {
    return board.groups().map(g => {
      // label the stone closest to the group's centre
      return { at: g.stones[0], type: 'label', text: String(g.libs.size) };
    });
  }

  /* ---------------- Explore: free play on a board ---------------- */

  function explore(host, spec) {
    const start = makeBoard(spec);
    const w = shell(host, spec, start.size);
    let board = start.clone(), history = [];
    const mode = spec.toPlay || 'alternate'; // 'alternate' | 'black' | 'white'
    let showLibs = spec.libs === 'on', showCounts = !!spec.counts;
    const fixed = colorOf(mode);
    if (fixed) board.toPlay = fixed;
    const draw = (animate) => {
      w.view.set(board, animate);
      const marks = [];
      if (showLibs) marks.push(...libMarks(board));
      if (spec.atari) marks.push(...atariMarks(board));
      if (showCounts) marks.push(...libCountLabels(board));
      if (board.lastMove != null && board.lastMove >= 0 && spec.last !== false) marks.push({ at: board.lastMove, type: 'last' });
      if (spec.marks) marks.push(...(typeof spec.marks === 'function' ? spec.marks(board) : spec.marks));
      w.view.mark(marks);
      w.view.hoverColor = board.toPlay;
    };
    const statusLine = () => {
      const t = fixed ? '' : `<b>${Go.colorName(board.toPlay)}</b> to play.`;
      const caps = spec.prisoners === false ? '' : ` Captured so far: Black ${board.prisoners[BLACK]}, White ${board.prisoners[WHITE]}.`;
      return t + caps;
    };
    w.view.interactive = true;
    w.view.onClick = i => {
      const before = board.clone();
      const r = board.play(i, board.toPlay);
      if (!r.ok) { w.say(ILLEGAL[r.reason], 'bad'); return; }
      if (fixed) board.toPlay = fixed;
      history.push(before);
      draw(true);
      let msg = null;
      if (spec.onMove) msg = spec.onMove({ board, result: r, before, name: board.name(i), complete: w.complete });
      if (spec.goal) { const g = spec.goal(board, r); if (g) { w.complete(); msg = { html: g, tone: 'good' }; } }
      if (msg) w.say(msg.html || msg, msg.tone || 'info');
      else if (r.captured.length) w.say(`Captured ${r.captured.length} stone${r.captured.length > 1 ? 's' : ''}. ` + statusLine(), 'good');
      else w.say(statusLine());
    };
    w.button('Undo', () => { if (history.length) { board = history.pop(); draw(false); w.say(statusLine()); } });
    w.button('Reset', () => { board = start.clone(); if (fixed) board.toPlay = fixed; history = []; draw(false); w.say(statusLine()); });
    if (spec.libs === 'toggle') {
      const b = w.button('Show liberties', () => { showLibs = !showLibs; b.setAttribute('aria-pressed', showLibs); draw(false); }, 'toggle');
      b.setAttribute('aria-pressed', 'false');
    }
    if (spec.countsToggle) {
      const b = w.button('Count liberties', () => { showCounts = !showCounts; b.setAttribute('aria-pressed', showCounts); draw(false); }, 'toggle');
      b.setAttribute('aria-pressed', String(showCounts));
    }
    draw(false);
    w.say(spec.status || statusLine());
    return w;
  }

  /* ---------------- Replay: step through a sequence ---------------- */

  function replay(host, spec) {
    const start = makeBoard(spec);
    const w = shell(host, spec, start.size);
    w.host.classList.add('replay');
    const steps = spec.steps;
    // Pre-compute every position.
    const states = [{ board: start.clone(), step: { text: spec.intro || 'Press the play button or the arrows to step through.' , marks: spec.introMarks } }];
    let b = start.clone();
    for (const s of steps) {
      b = b.clone();
      if (s.play) {
        const c = colorOf(s.color) || b.toPlay;
        const r = b.play(s.play, c);
        if (!r.ok) throw new Error('Replay move failed: ' + s.play + ' ' + r.reason);
      }
      if (s.remove) for (const p of s.remove) b.grid[b.idx(p)] = EMPTY;
      if (s.add) for (const [p, c] of s.add) b.grid[b.idx(p)] = colorOf(c);
      states.push({ board: b, step: s });
    }
    let k = 0, timer = null;
    const counter = h('span', { class: 'w-counter' });
    const show = (animate) => {
      const { board, step } = states[k];
      w.view.set(board, animate);
      const marks = [];
      if (step.libsOf) [].concat(step.libsOf).forEach(p => marks.push(...libMarks(board, p)));
      if (step.allLibs) marks.push(...libMarks(board));
      if (step.play && step.lastMark !== false) marks.push({ at: step.play, type: 'last' });
      if (step.marks) marks.push(...step.marks);
      w.view.mark(marks);
      w.say(step.text || '', step.tone);
      counter.textContent = `Step ${k} of ${states.length - 1}`;
      prev.disabled = k === 0; next.disabled = k === states.length - 1;
      if (k === states.length - 1) { stop(); w.complete(); }
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; playBtn.textContent = 'Play'; } };
    const go = (to, animate) => { k = Math.max(0, Math.min(states.length - 1, to)); show(animate); };
    const first = w.button('Start', () => { stop(); go(0, false); });
    first.setAttribute('aria-label', 'Go to start');
    const prev = w.button('Back', () => { stop(); go(k - 1, false); });
    const next = w.button('Next', () => { stop(); go(k + 1, true); }, 'primary');
    const playBtn = w.button('Play', () => {
      if (timer) { stop(); return; }
      if (k === states.length - 1) go(0, false);
      playBtn.textContent = 'Pause';
      timer = setInterval(() => { if (k < states.length - 1) go(k + 1, true); else stop(); }, spec.speed || 1700);
    });
    w.controls.append(counter);
    go(0, false);
    return w;
  }

  /* ---------------- Pick points: click all the points that ... ---------------- */

  function pickPoints(host, spec) {
    const board = makeBoard(spec);
    const w = shell(host, spec, board.size);
    const targets = new Set((typeof spec.targets === 'function' ? [...spec.targets(board)] : spec.targets).map(p => board.idx(p)));
    const picked = new Set();
    let revealed = false;
    const draw = () => {
      const marks = [...picked].map(i => ({ at: i, type: 'pick' }));
      if (revealed) for (const t of targets) if (!picked.has(t)) marks.push({ at: t, type: 'lib', tone: 'ghost' });
      if (spec.marks) marks.push(...spec.marks);
      w.view.mark(marks);
    };
    w.view.set(board, false);
    w.view.interactive = true;
    w.view.onClick = i => {
      if (board.grid[i] && !spec.allowStones) { w.say(spec.stoneMessage || 'Liberties are empty points. Click the empty intersections, not the stones.', 'bad'); return; }
      picked.has(i) ? picked.delete(i) : picked.add(i);
      w.say(`You have marked ${picked.size} point${picked.size === 1 ? '' : 's'}.`);
      draw();
    };
    let tries = 0;
    w.button('Check', () => {
      tries++;
      const right = [...picked].filter(i => targets.has(i)).length;
      const extra = [...picked].filter(i => !targets.has(i)).length;
      const missed = targets.size - right;
      if (!extra && !missed) { w.say(spec.success || 'Correct!', 'good'); w.complete(); return; }
      const parts = [];
      if (missed) parts.push(`you are missing ${missed}`);
      if (extra) parts.push(`${extra} of your marks ${extra === 1 ? 'is' : 'are'} not right`);
      let msg = 'Not yet: ' + parts.join(', and ') + '.';
      if (extra && spec.extraHint) msg += ' ' + spec.extraHint;
      else if (missed && spec.missHint) msg += ' ' + spec.missHint;
      if (tries >= 2) { msg += ' Press “Show me” to see the answer.'; showBtn.hidden = false; }
      w.say(msg, 'bad');
    }, 'primary');
    w.button('Clear', () => { picked.clear(); revealed = false; draw(); w.say(''); });
    const showBtn = w.button('Show me', () => {
      revealed = true; draw();
      w.say((spec.reveal || 'The hollow dots show the points you missed.'), 'info');
    });
    showBtn.hidden = true;
    draw();
    return w;
  }

  /* ---------------- Choice: a multiple-choice question ---------------- */

  function choice(host, spec) {
    host = $(host);
    let w;
    if (spec.setup || spec.board) {
      const board = makeBoard(spec);
      w = shell(host, spec, board.size);
      w.view.set(board, false);
      w.view.mark(spec.marks || []);
    } else {
      host.classList.add('widget', 'no-board');
      const side = h('div', { class: 'w-side' });
      const prompt = h('div', { class: 'w-prompt', html: spec.prompt || '' });
      const status = h('div', { class: 'w-status', 'aria-live': 'polite' });
      const controls = h('div', { class: 'w-controls' });
      side.append(prompt, status, controls);
      host.append(side);
      if (spec.checkpoint) progress.register(spec.checkpoint);
      w = {
        host, prompt, status, controls,
        say(html, tone) { status.className = 'w-status' + (tone ? ' ' + tone : ''); status.innerHTML = html || ''; },
        complete() { if (spec.checkpoint) progress.complete(spec.checkpoint); },
      };
      if (spec.checkpoint) {
        const badge = h('span', { class: 'w-badge' }, 'Done');
        host.prepend(badge);
        const sync = () => badge.classList.toggle('on', progress.isDone(spec.checkpoint));
        progress.listeners.push(sync); sync();
      }
    }
    const list = h('div', { class: 'choices', role: 'group' });
    w.controls.before(list);
    spec.options.forEach(opt => {
      const b = h('button', { class: 'choice', type: 'button', html: opt.text });
      b.addEventListener('click', () => {
        list.querySelectorAll('.choice').forEach(x => x.classList.remove('picked'));
        b.classList.add('picked', opt.correct ? 'right' : 'wrong');
        w.say(opt.why || (opt.correct ? 'Correct.' : 'Not quite. Try another answer.'), opt.correct ? 'good' : 'bad');
        if (opt.correct) {
          w.complete();
          if (spec.after && w.view) w.view.mark(spec.after);
        }
      });
      list.append(b);
    });
    return w;
  }

  /* ---------------- Puzzle and puzzle sets ---------------- */

  // A puzzle spec:
  //   setup, toPlay, prompt
  //   answers: ['C3'] or {C3: 'message'}           one-move puzzles
  //   tree: {C3: {reply:'D3', msg, next:{...}}}    multi-move puzzles
  //   mode: 'kill' | 'save', target: 'D4'           judged by reading
  //   wrong: {D4: 'why that fails'}, hint, explain
  function puzzle(host, spec, hooks) {
    const start = makeBoard(spec);
    const me = colorOf(spec.toPlay) || BLACK;
    start.toPlay = me;
    const w = shell(host, spec, start.size);
    w.host.classList.add('puzzle');
    let board, node, solved, wrongs, busy;
    const target = spec.target ? start.idx(spec.target) : null;

    const draw = (animate, extra) => {
      w.view.set(board, animate);
      const marks = [];
      if (spec.marks && !solved) marks.push(...spec.marks);
      if (spec.showLibs && target != null && board.grid[target]) marks.push(...libMarks(board, target));
      if (board.lastMove != null && board.lastMove >= 0) marks.push({ at: board.lastMove, type: 'last' });
      if (extra) marks.push(...extra);
      w.view.mark(marks);
      w.view.hoverColor = me;
    };
    const reset = () => {
      board = start.clone(); node = spec.tree || null; solved = false; busy = false;
      w.view.interactive = true;
      draw(false);
    };
    const succeed = (msg) => {
      solved = true; w.view.interactive = false;
      w.say((msg ? msg + ' ' : '') + (spec.explain || ''), 'good');
      w.complete();
      if (hooks && hooks.onSolve) hooks.onSolve();
    };
    const fail = (i, msg) => {
      wrongs++;
      const name = board.name(i);
      let text = (spec.wrong && spec.wrong[name]) || msg || spec.defaultWrong || 'That doesn’t work. Look again.';
      if (wrongs >= 2) { text += ' <span class="hint">Stuck? Press “Show answer”.</span>'; showBtn.hidden = false; }
      else if (spec.hint) text += ' <span class="hint">Hint: ' + spec.hint + '</span>';
      w.say(text, 'bad');
      draw(true, [{ at: i, type: 'x', tone: 'danger' }]);
      busy = true;
      setTimeout(() => { reset(); busy = false; }, 1300);
    };
    const answerKeys = () => {
      if (node) return Object.keys(node);
      if (Array.isArray(spec.answers)) return spec.answers;
      if (spec.answers) return Object.keys(spec.answers);
      return [];
    };

    w.view.onClick = async i => {
      if (busy || solved) return;
      const before = board.clone();
      const r = board.play(i, me);
      if (!r.ok) { w.say(ILLEGAL[r.reason], 'bad'); return; }
      const name = board.name(i);
      draw(true);

      if (spec.judge) {
        const v = spec.judge({ before, board, result: r, name });
        if (v.correct) return succeed(v.msg);
        return fail(i, v.msg);
      }
      if (spec.mode === 'kill') {
        if (!board.grid[target] || board.grid[target] === me) return succeed(spec.success || 'Captured!');
        // It is now the defender's turn: if the defender can reach safety, the move failed.
        if (Go.defend(board.clone(), target)) {
          const esc = findSave(board, target, opp(me));
          return fail(i, esc != null ? `${Go.colorName(opp(me))} escapes by playing ${board.name(esc)}.` : 'The stones can escape after that move.');
        }
        // Opponent resists.
        busy = true; w.view.interactive = false;
        await wait(550);
        const reply = Go.bestResistance(board, target);
        const rr = reply != null ? board.play(reply, opp(me)) : board.play(PASS, opp(me));
        board.toPlay = me;
        draw(true);
        busy = false; w.view.interactive = true;
        const verb = rr.captured && rr.captured.length ? `captures at ${board.name(reply)}` : `runs to ${reply != null ? board.name(reply) : ''}`;
        w.say(reply != null ? `${Go.colorName(opp(me))} ${verb}. Keep going.` : `${Go.colorName(opp(me))} has no way to run. Finish it.`, 'info');
        return;
      }
      if (spec.mode === 'save') {
        const tg = board.group(target);
        if (!tg) { return fail(i); }
        const safe = tg.libs.size >= 3 || Go.attack(toMove(board, opp(me)), target) === null;
        if (safe) return succeed(spec.success || 'Safe!');
        return fail(i, 'Your stones can still be captured after that move.');
      }
      if (node) {
        const a = node[name];
        if (!a) { return fail(i); }
        if (a.reply) {
          busy = true; w.view.interactive = false;
          if (a.msg) w.say(a.msg, 'info');
          await wait(600);
          board.play(a.reply, opp(me)); board.toPlay = me;
          draw(true);
          busy = false; w.view.interactive = true;
        }
        if (a.next) { node = a.next; if (!a.msg) w.say('Good. What now?', 'info'); return; }
        return succeed(a.win || a.msg);
      }
      const ans = answerKeys();
      if (ans.includes(name)) {
        const msg = spec.answers && !Array.isArray(spec.answers) ? spec.answers[name] : null;
        return succeed(msg || (r.captured.length ? 'Captured!' : 'Correct!'));
      }
      if (spec.goal === 'capture' && r.captured.length && (target == null || !board.grid[target])) return succeed('Captured!');
      fail(i);
    };

    const showBtn = w.button('Show answer', async () => {
      reset();
      w.view.interactive = false; busy = true;
      let move = null;
      if (spec.mode === 'kill') move = Go.attack(toMove(board, me), target);
      else if (spec.mode === 'save') move = findSave(board, target, me);
      else move = answerKeys()[0];
      if (move == null) { busy = false; w.view.interactive = true; return; }
      const name = typeof move === 'number' ? board.name(move) : move;
      board.play(name, me);
      draw(true, [{ at: name, type: 'ring', tone: 'good' }]);
      w.say(`The answer is <b>${name}</b>. ${spec.explain || ''} Press “Try again” to play it yourself.`, 'info');
    });
    showBtn.hidden = true;
    w.button('Try again', () => { reset(); w.say(spec.prompt2 || ''); });
    wrongs = 0;
    reset();
    return w;
  }
  function toMove(board, color) { const b = board.clone(); b.toPlay = color; return b; }
  function findSave(board, target, me) {
    const g = board.group(target);
    for (const c of Go.defenseMoves(board, g)) {
      const b = board.clone();
      if (!b.play(c, me).ok) continue;
      const g2 = b.group(target);
      if (g2 && (g2.libs.size >= 3 || Go.attack(b, target) === null)) return c;
    }
    return null;
  }

  // A run of puzzles shown one at a time.
  function puzzleSet(host, spec) {
    host = $(host);
    host.classList.add('pset');
    const head = h('div', { class: 'pset-head' });
    const dots = h('div', { class: 'pset-dots', role: 'tablist' });
    const label = h('span', { class: 'pset-label' });
    head.append(label, dots);
    const stage = h('div', { class: 'pset-stage' });
    const nav = h('div', { class: 'pset-nav' });
    const prevB = h('button', { class: 'btn', type: 'button' }, 'Previous problem');
    const nextB = h('button', { class: 'btn primary', type: 'button' }, 'Next problem');
    nav.append(prevB, nextB);
    host.append(head, stage, nav);
    const ids = spec.puzzles.map((p, k) => p.checkpoint || `${spec.id}-${k + 1}`);
    ids.forEach(id => progress.register(id));
    let k = 0;
    const dotEls = spec.puzzles.map((p, j) => {
      const d = h('button', { class: 'pset-dot', type: 'button', 'aria-label': `Problem ${j + 1}`, onclick: () => open(j) }, String(j + 1));
      dots.append(d); return d;
    });
    const sync = () => dotEls.forEach((d, j) => { d.classList.toggle('done', progress.isDone(ids[j])); d.classList.toggle('cur', j === k); });
    progress.listeners.push(sync);
    function open(j) {
      k = j;
      stage.textContent = '';
      const box = h('div');
      stage.append(box);
      const p = Object.assign({}, spec.puzzles[j], { checkpoint: ids[j] });
      puzzle(box, p, { onSolve: () => { nextB.classList.add('pulse'); } });
      label.textContent = `${spec.title || 'Problems'}: ${j + 1} of ${spec.puzzles.length}`;
      prevB.disabled = j === 0;
      nextB.disabled = j === spec.puzzles.length - 1;
      nextB.classList.remove('pulse');
      sync();
    }
    prevB.addEventListener('click', () => open(k - 1));
    nextB.addEventListener('click', () => open(k + 1));
    open(0);
  }

  /* ---------------- Capture Go against the computer ---------------- */

  function captureGame(host, spec) {
    spec = Object.assign({ size: 7, target: 1 }, spec);
    const w = shell(host, spec, spec.size);
    w.host.classList.add('game');
    let board, human = BLACK, over = false, history = [], score = { win: 0, loss: 0 };
    let level = 1, helper = true;
    const opts = h('div', { class: 'w-opts' });
    const lvl = h('select', { id: (spec.idPrefix || 'cg') + '-level', 'aria-label': 'Computer strength' },
      h('option', { value: '0' }, 'Computer: Easy'), h('option', { value: '1', selected: 'selected' }, 'Computer: Normal'), h('option', { value: '2' }, 'Computer: Hard'));
    lvl.addEventListener('change', () => { level = +lvl.value; });
    const col = h('select', { id: (spec.idPrefix || 'cg') + '-color', 'aria-label': 'Your colour' },
      h('option', { value: '1' }, 'You play Black (first)'), h('option', { value: '2' }, 'You play White (second)'));
    col.addEventListener('change', () => { human = +col.value; newGame(); });
    opts.append(lvl, col);
    w.controls.before(opts);
    const tally = h('p', { class: 'w-tally' });
    w.side.append(tally);
    const drawTally = () => { tally.textContent = `This session: you ${score.win}, computer ${score.loss}.`; };

    const draw = (animate) => {
      w.view.set(board, animate);
      const marks = [];
      if (helper) marks.push(...atariMarks(board));
      if (board.lastMove != null && board.lastMove >= 0) marks.push({ at: board.lastMove, type: 'last' });
      w.view.mark(marks);
      w.view.hoverColor = human;
    };
    const checkEnd = () => {
      const goal = spec.target;
      if (board.prisoners[human] >= goal) { over = true; score.win++; w.say(`<b>You win!</b> You captured ${goal === 1 ? 'a stone' : goal + ' stones'} first.`, 'good'); w.complete(); }
      else if (board.prisoners[opp(human)] >= goal) { over = true; score.loss++; w.say(`<b>The computer wins.</b> Look at the board: which of your stones ran out of liberties, and when did they get down to one? Press “New game” to try again.`, 'bad'); }
      if (over) { w.view.interactive = false; drawTally(); }
      return over;
    };
    const botMove = async () => {
      w.view.interactive = false;
      w.say('The computer is thinking…');
      await wait(450);
      const m = Go.captureBotMove(board, opp(human), level);
      board.play(m, opp(human));
      draw(true);
      if (!checkEnd()) {
        w.view.interactive = true;
        const inAtari = board.groups(human).some(g => g.libs.size === 1);
        w.say(inAtari ? '<b>Careful:</b> one of your groups is in atari (red ring). Save it, or capture first!' : 'Your move.', inAtari ? 'warn' : '');
      }
    };
    w.view.onClick = i => {
      if (over || board.toPlay !== human) return;
      const before = board.clone();
      const r = board.play(i, human);
      if (!r.ok) { w.say(ILLEGAL[r.reason], 'bad'); return; }
      history.push(before);
      draw(true);
      if (!checkEnd()) botMove();
    };
    function newGame() {
      board = spec.setup ? Board.fromRows(spec.setup) : new Board(spec.size);
      board.toPlay = BLACK; over = false; history = [];
      draw(false);
      w.view.interactive = true;
      if (human === WHITE) botMove(); else w.say('You are Black. Play anywhere to begin.');
    }
    w.button('New game', newGame, 'primary');
    w.button('Undo', () => {
      if (!history.length || board.toPlay !== human && !over) return;
      board = history.pop(); over = false; w.view.interactive = true; draw(false); w.say('Move taken back. Your move.');
    });
    const hb = w.button('Danger rings', () => { helper = !helper; hb.setAttribute('aria-pressed', helper); draw(false); }, 'toggle');
    hb.setAttribute('aria-pressed', 'true');
    drawTally();
    newGame();
    return w;
  }

  // Score table shown at the end of a full game (area count, with the
  // territory count for comparison).
  function scoreHTML(board, dead, komi, s, resultLine) {
    const terr = Go.scoreTerritory(board, dead, komi);
    return `
      <table class="score-table">
        <thead><tr><th></th><th>Black</th><th>White</th></tr></thead>
        <tbody>
          <tr><th>Stones on the board</th><td>${s.blackStones}</td><td>${s.whiteStones}</td></tr>
          <tr><th>Surrounded empty points</th><td>${s.blackTerritory}</td><td>${s.whiteTerritory}</td></tr>
          <tr><th>Komi</th><td>–</td><td>${komi}</td></tr>
          <tr class="total"><th>Area score</th><td>${s.black}</td><td>${s.white}</td></tr>
        </tbody>
      </table>
      <p class="score-result">${resultLine}</p>
      <p class="score-note">Counted the Japanese way (territory plus prisoners), the score would be Black ${terr.black}, White ${terr.white}: ${terr.winner === s.winner ? 'the same winner' : 'a different winner, which is rare'}.</p>`;
  }

  /* ---------------- Full game on a small board ---------------- */

  function fullGame(host, spec) {
    spec = Object.assign({ size: 9, komi: 7.5 }, spec);
    const w = shell(host, spec, spec.size);
    w.host.classList.add('game');
    const LEVELS = [{ name: 'Beginner', playouts: 1000 }, { name: 'Club', playouts: 3000 }, { name: 'Strong', playouts: 10000 }];
    let board, human = BLACK, history = [], phase = 'play', dead = new Set(), level = 0, komi = spec.komi, showOwn = false, lastOwn = null;
    const pre = spec.idPrefix || 'fg';
    const opts = h('div', { class: 'w-opts' });
    const lvl = h('select', { id: pre + '-level', 'aria-label': 'Computer strength' }, ...LEVELS.map((L, k) => h('option', { value: String(k) }, 'Computer: ' + L.name)));
    lvl.addEventListener('change', () => { level = +lvl.value; });
    const col = h('select', { id: pre + '-color', 'aria-label': 'Your colour' }, h('option', { value: '1' }, 'You play Black'), h('option', { value: '2' }, 'You play White'));
    col.addEventListener('change', () => { human = +col.value; newGame(); });
    const km = h('select', { id: pre + '-komi', 'aria-label': 'Komi' }, h('option', { value: String(spec.komi) }, `Komi ${spec.komi} (standard)`), h('option', { value: '0.5' }, 'Komi 0.5 (easier for Black)'));
    km.addEventListener('change', () => { komi = +km.value; newGame(); });
    opts.append(lvl, col, km);
    w.controls.before(opts);
    const scoreBox = h('div', { class: 'w-score' });
    w.side.append(scoreBox);

    const draw = (animate) => {
      w.view.set(board, animate);
      const marks = [];
      if (phase === 'score') {
        const s = Go.scoreArea(board, dead, komi);
        for (const d of dead) marks.push({ at: d, type: 'dead' });
        for (let i = 0; i < board.grid.length; i++) {
          if ((!board.grid[i] || dead.has(i)) && s.owner[i]) marks.push({ at: i, type: 'terr', color: s.owner[i] });
        }
        renderScore(s);
      } else {
        scoreBox.textContent = '';
        if (showOwn && lastOwn) for (let i = 0; i < lastOwn.length; i++) {
          const o = lastOwn[i];
          if (Math.abs(o) > 0.25) marks.push({ at: i, type: 'shade', color: o > 0 ? BLACK : WHITE, alpha: Math.min(0.55, Math.abs(o) * 0.55) });
        }
        if (board.lastMove != null && board.lastMove >= 0) marks.push({ at: board.lastMove, type: 'last' });
      }
      w.view.mark(marks);
      w.view.hoverColor = phase === 'play' ? human : null;
    };
    function renderScore(s) {
      const res = s.winner === human ? 'You win' : 'The computer wins';
      scoreBox.innerHTML = scoreHTML(board, dead, komi, s, `<b>${res}</b> by ${s.margin} point${s.margin === 1 ? '' : 's'} (${s.winner === BLACK ? 'Black' : 'White'} wins).`);
    }
    const toScoring = async () => {
      phase = 'score';
      w.view.interactive = false;
      w.say('Both players passed, so the game is over. Working out which stones are dead…');
      await wait(30);
      dead = Go.guessDead(board, komi);
      w.view.interactive = true;
      w.say('Stones the computer thinks are dead are shown faded. If you disagree, click a group to mark it alive or dead. Small squares show whose area each empty point is.', 'info');
      passB.hidden = true; resB.hidden = true; resumeB.hidden = false; acceptB.hidden = false;
      draw(false);
    };
    const botMove = async () => {
      w.view.interactive = false;
      w.say('The computer is thinking…');
      await wait(60);
      const r = await Go.mcMove(board, opp(human), { playouts: LEVELS[level].playouts, komi, yieldEvery: 250 });
      lastOwn = r.ownership;
      const res = board.play(r.move, opp(human));
      if (!res.ok) board.play(PASS, opp(human));
      draw(true);
      if (r.move === PASS) {
        if (board.passes >= 2) return toScoring();
        w.say('The computer <b>passed</b>. It thinks the game is finished. If you agree, pass too. If there is still something worth playing, play it.', 'warn');
      } else w.say(`The computer played ${board.name(r.move)}. Your move.`);
      w.view.interactive = true;
    };
    w.view.onClick = i => {
      if (phase === 'score') {
        if (!board.grid[i]) return;
        const g = board.group(i);
        const isDead = dead.has(i);
        g.stones.forEach(s => (isDead ? dead.delete(s) : dead.add(s)));
        draw(false); return;
      }
      if (board.toPlay !== human) return;
      const before = board.clone();
      const r = board.play(i, human);
      if (!r.ok) { w.say(ILLEGAL[r.reason], 'bad'); return; }
      history.push(before);
      draw(true);
      botMove();
    };
    function newGame() {
      board = new Board(spec.size); board.toPlay = BLACK;
      history = []; phase = 'play'; dead = new Set(); lastOwn = null;
      passB.hidden = false; resB.hidden = false; resumeB.hidden = true; acceptB.hidden = true;
      draw(false);
      w.view.interactive = true;
      if (human === WHITE) botMove(); else w.say('You are Black, so you move first.');
    }
    const passB = w.button('Pass', () => {
      if (phase !== 'play' || board.toPlay !== human) return;
      history.push(board.clone());
      board.play(PASS, human);
      if (board.passes >= 2) toScoring(); else botMove();
    });
    w.button('Undo', () => {
      if (phase !== 'play' || !history.length || board.toPlay !== human) return;
      board = history.pop(); draw(false); w.say('Your last move was taken back.');
    });
    const resB = w.button('Resign', () => {
      if (phase !== 'play') return;
      phase = 'over'; w.view.interactive = false;
      w.say('You resigned. Press “New game” to play again.', 'bad');
    });
    const ob = w.button('Who owns what?', () => { showOwn = !showOwn; ob.setAttribute('aria-pressed', showOwn); draw(false); }, 'toggle');
    ob.setAttribute('aria-pressed', 'false');
    const resumeB = w.button('Keep playing', () => {
      phase = 'play'; dead = new Set(); board.passes = 0; board.toPlay = human;
      passB.hidden = false; resB.hidden = false; resumeB.hidden = true; acceptB.hidden = true;
      w.view.interactive = true; draw(false); w.say('Play continues. Your move.');
    });
    const acceptB = w.button('Accept the result', () => {
      w.complete(); phase = 'over'; w.view.interactive = false;
      acceptB.hidden = true; resumeB.hidden = true;
      w.say('Game recorded. Press “New game” to play another.', 'good');
    }, 'primary');
    w.button('New game', newGame, 'primary');
    newGame();
    return w;
  }


  /* ---------------- Two players on one screen ---------------- */

  // Standard handicap points, in placement order, as [x, y] from the top left.
  function handicapPoints(n, count) {
    const lo = n >= 13 ? 3 : 2, hi = n - 1 - lo, mid = (n - 1) / 2;
    const corners = [[hi, lo], [lo, hi], [hi, hi], [lo, lo]];
    const leftRight = [[lo, mid], [hi, mid]], topBottom = [[mid, lo], [mid, hi]], centre = [[mid, mid]];
    if (count <= 4) return corners.slice(0, count);
    if (count === 5) return corners.concat(centre);
    if (count === 6) return corners.concat(leftRight);
    if (count === 7) return corners.concat(leftRight, centre);
    if (count === 8) return corners.concat(leftRight, topBottom);
    return corners.concat(leftRight, topBottom, centre);
  }

  function friendGame(host, spec) {
    spec = spec || {};
    const KEY = 'go-first-moves:friend-game';
    const w = shell(host, spec, 9);
    w.host.classList.add('game', 'big');
    const boardBox = w.view.root.parentNode;
    let cfg = { size: 9, komi: 7.5, handicap: 0 }, moves = [], board, phase = 'play', dead = new Set(), resultText = '';

    const opt = (v, t) => h('option', { value: String(v) }, t);
    const sizeSel = h('select', { id: 'pf-size', 'aria-label': 'Board size' }, opt(9, '9×9 board'), opt(13, '13×13 board'), opt(19, '19×19 board'));
    const komiSel = h('select', { id: 'pf-komi', 'aria-label': 'Komi' },
      opt(7.5, 'Komi 7.5 (standard)'), opt(6.5, 'Komi 6.5 (Japanese rules)'), opt(0.5, 'Komi 0.5 (only breaks ties)'), opt(0, 'No komi'));
    const hcSel = h('select', { id: 'pf-handicap', 'aria-label': 'Handicap stones' });
    const fillHandicap = () => {
      const max = +sizeSel.value === 9 ? 5 : 9, keep = +hcSel.value || 0;
      hcSel.textContent = '';
      hcSel.append(opt(0, 'No handicap'));
      for (let k = 2; k <= max; k++) hcSel.append(opt(k, `Black gets ${k} handicap stones`));
      hcSel.value = String(Math.min(keep, max));
    };
    sizeSel.addEventListener('change', fillHandicap);
    hcSel.addEventListener('change', () => { if (+hcSel.value >= 2) komiSel.value = '0.5'; });
    fillHandicap();
    const opts = h('div', { class: 'w-opts' }, sizeSel, komiSel, hcSel);
    const optNote = h('p', { class: 'w-tally' }, 'Changes to these settings take effect when you press “Start new game”.');
    w.controls.before(opts, optNote);
    const info = h('p', { class: 'w-tally' });
    const scoreBox = h('div', { class: 'w-score' });
    w.side.append(info, scoreBox);

    const save = () => {
      try { localStorage.setItem(KEY, JSON.stringify({ cfg, moves })); } catch (e) { /* storage unavailable */ }
    };
    // Rebuild the position from the settings and the list of moves.
    const rebuild = () => {
      board = new Board(cfg.size);
      for (const [x, y] of handicapPoints(cfg.size, cfg.handicap)) board.grid[y * cfg.size + x] = BLACK;
      board.toPlay = cfg.handicap >= 2 ? WHITE : BLACK;
      for (const m of moves) board.play(m);
    };
    const setView = () => {
      if (w.view.n === cfg.size) return;
      boardBox.textContent = '';
      const onClick = w.view.onClick;
      w.view = new BoardView(boardBox, { size: cfg.size });
      w.view.onClick = onClick;
    };
    const draw = (animate) => {
      w.view.set(board, animate);
      const marks = [];
      if (phase === 'score' || phase === 'done') {
        const s = Go.scoreArea(board, dead, cfg.komi);
        for (const d of dead) marks.push({ at: d, type: 'dead' });
        for (let i = 0; i < board.grid.length; i++) {
          if ((!board.grid[i] || dead.has(i)) && s.owner[i]) marks.push({ at: i, type: 'terr', color: s.owner[i] });
        }
        resultText = s.winner ? `${Go.colorName(s.winner)} wins by ${s.margin} point${s.margin === 1 ? '' : 's'}` : 'The game is a draw';
        scoreBox.innerHTML = scoreHTML(board, dead, cfg.komi, s, `<b>${resultText}.</b>`);
      } else {
        scoreBox.textContent = '';
        if (board.lastMove != null && board.lastMove >= 0) marks.push({ at: board.lastMove, type: 'last' });
      }
      w.view.mark(marks);
      w.view.hoverColor = phase === 'play' ? board.toPlay : null;
      w.view.interactive = phase === 'play' || phase === 'score';
      const played = moves.length;
      info.textContent = `${cfg.size}×${cfg.size}, komi ${cfg.komi}${cfg.handicap ? `, ${cfg.handicap} handicap stones` : ''}. Moves played: ${played}. Captured so far: Black ${board.prisoners[BLACK]}, White ${board.prisoners[WHITE]}.`;
      passB.hidden = resignB.hidden = phase !== 'play';
      resumeB.hidden = acceptB.hidden = phase !== 'score';
    };
    const turnText = () => `<b>${Go.colorName(board.toPlay)}</b> to play.`;

    const toScoring = async () => {
      phase = 'score';
      w.view.interactive = false;
      w.say('Both players passed in a row, so the game is over. Working out which stones are dead…');
      await wait(30);
      const playouts = cfg.size === 9 ? 1000 : cfg.size === 13 ? 800 : 600;
      dead = Go.guessDead(board, cfg.komi, playouts);
      draw(false);
      w.say('Faded stones are the computer’s guess at which stones are dead. Both players must agree. Click any group to switch it between dead and alive, then press “Accept the result”. Small squares show whose area each empty point is.', 'info');
    };

    w.view.onClick = i => {
      if (phase === 'score') {
        if (!board.grid[i]) return;
        const isDead = dead.has(i);
        board.group(i).stones.forEach(s => (isDead ? dead.delete(s) : dead.add(s)));
        draw(false); return;
      }
      if (phase !== 'play') return;
      const r = board.play(i);
      if (!r.ok) { w.say(ILLEGAL[r.reason], 'bad'); return; }
      moves.push(i); save();
      draw(true);
      w.say((r.captured.length ? `${Go.colorName(r.color)} captured ${r.captured.length} stone${r.captured.length > 1 ? 's' : ''}. ` : '') + turnText(), r.captured.length ? 'good' : '');
    };

    const passB = w.button('Pass', () => {
      if (phase !== 'play') return;
      const who = board.toPlay;
      board.play(PASS); moves.push(PASS); save();
      if (board.passes >= 2) { toScoring(); return; }
      draw(false);
      w.say(`${Go.colorName(who)} passed. If ${Go.colorName(opp(who))} passes too, the game ends and is scored. ` + turnText(), 'warn');
    });
    w.button('Undo', () => {
      if (!moves.length || phase === 'done' || phase === 'over') return;
      moves.pop(); phase = 'play'; dead = new Set(); save();
      rebuild(); draw(false);
      w.say('The last move was taken back. ' + turnText());
    });
    const resignB = w.button('Resign', () => {
      if (phase !== 'play') return;
      if (resignB.dataset.armed !== '1') {
        resignB.dataset.armed = '1'; resignB.textContent = `Press again: ${Go.colorName(board.toPlay)} resigns`;
        setTimeout(() => { resignB.dataset.armed = ''; resignB.textContent = 'Resign'; }, 3000);
        return;
      }
      resignB.dataset.armed = ''; resignB.textContent = 'Resign';
      const loser = board.toPlay;
      phase = 'over'; draw(false);
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      w.say(`${Go.colorName(loser)} resigned, so <b>${Go.colorName(opp(loser))} wins</b>. Press “Start new game” to play again.`, 'good');
    });
    const resumeB = w.button('Keep playing', () => {
      // Take back the two passes and continue the game.
      while (moves.length && moves[moves.length - 1] === PASS) moves.pop();
      phase = 'play'; dead = new Set(); save();
      rebuild(); draw(false);
      w.say('Play continues. ' + turnText());
    });
    const acceptB = w.button('Accept the result', () => {
      phase = 'done'; draw(false);
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
      w.complete();
      w.say(`Game over. ${resultText}. Press “Start new game” to play again.`, 'good');
    }, 'primary');
    const newB = w.button('Start new game', () => {
      if (phase === 'play' && moves.length && newB.dataset.armed !== '1') {
        newB.dataset.armed = '1'; newB.textContent = 'Press again to abandon this game';
        setTimeout(() => { newB.dataset.armed = ''; newB.textContent = 'Start new game'; }, 3000);
        return;
      }
      newB.dataset.armed = ''; newB.textContent = 'Start new game';
      start({ size: +sizeSel.value, komi: +komiSel.value, handicap: +hcSel.value }, []);
    }, 'primary');

    function start(c, mv, restored) {
      cfg = c; moves = mv; phase = 'play'; dead = new Set();
      sizeSel.value = String(cfg.size); fillHandicap(); hcSel.value = String(cfg.handicap); komiSel.value = String(cfg.komi);
      setView(); rebuild(); save(); draw(false);
      if (restored) w.say('Your unfinished game was restored, so you can carry on where you stopped. ' + turnText(), 'info');
      else w.say((cfg.handicap >= 2 ? `Black’s ${cfg.handicap} handicap stones are already on the board, so White moves first. ` : 'Black moves first. ') + turnText());
      if (board.passes >= 2) toScoring();
    }

    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { saved = null; }
    if (saved && saved.cfg && Array.isArray(saved.moves) && saved.moves.length) start(saved.cfg, saved.moves, true);
    else start(cfg, []);
    return w;
  }

  /* ---------------- Count the score yourself ---------------- */

  function countQuiz(host, spec) {
    const board = makeBoard(spec);
    const w = shell(host, spec, board.size);
    const dead = new Set((spec.dead || []).map(p => board.idx(p)));
    const komi = spec.komi || 0;
    const s = Go.scoreArea(board, dead, komi);
    w.view.set(board, false);
    const base = [...dead].map(d => ({ at: d, type: 'dead' }));
    w.view.mark(base);
    const pre = spec.idPrefix || ('cq' + uid);
    const ib = h('input', { type: 'number', id: pre + '-b', min: '0', inputmode: 'numeric' });
    const iw = h('input', { type: 'number', id: pre + '-w', min: '0', inputmode: 'numeric' });
    const form = h('div', { class: 'w-count' },
      h('label', { for: pre + '-b' }, 'Black’s area'), ib,
      h('label', { for: pre + '-w' }, `White’s area${komi ? ' (before komi)' : ''}`), iw);
    w.controls.before(form);
    const reveal = () => {
      const marks = base.slice();
      for (let i = 0; i < board.grid.length; i++) if ((!board.grid[i] || dead.has(i)) && s.owner[i]) marks.push({ at: i, type: 'terr', color: s.owner[i] });
      w.view.mark(marks);
    };
    const whiteNoKomi = s.white - komi;
    w.button('Check', () => {
      const b = +ib.value, wv = +iw.value;
      if (ib.value === '' || iw.value === '') { w.say('Fill in both numbers first.', 'bad'); return; }
      if (b === s.black && wv === whiteNoKomi) {
        reveal();
        w.say(`Correct. Black has ${s.blackStones} stones and ${s.blackTerritory} surrounded points, ${s.black} in total. White has ${s.whiteStones} stones and ${s.whiteTerritory} surrounded points, ${whiteNoKomi} in total. ${spec.explain || ''}`, 'good');
        w.complete();
      } else {
        const parts = [];
        if (b !== s.black) parts.push(`Black’s number is ${b > s.black ? 'too high' : 'too low'}`);
        if (wv !== whiteNoKomi) parts.push(`White’s number is ${wv > whiteNoKomi ? 'too high' : 'too low'}`);
        w.say(parts.join(', and ') + '. Remember: count each side’s stones, plus the empty points that only that side surrounds. Faded stones are dead, so their points belong to the other side.', 'bad');
      }
    }, 'primary');
    w.button('Show the count', () => {
      reveal();
      w.say(`Black: ${s.blackStones} stones + ${s.blackTerritory} empty points = ${s.black}. White: ${s.whiteStones} stones + ${s.whiteTerritory} empty points = ${whiteNoKomi}.`, 'info');
    });
    return w;
  }

  /* ---------------- Lesson page chrome ---------------- */

  function initLesson(opts) {
    progress.init(opts.id);
    document.addEventListener('DOMContentLoaded', () => {
      const bar = document.querySelector('[data-progress]');
      const text = document.querySelector('[data-progress-text]');
      if (bar || text) progress.on((done, total) => {
        if (bar) bar.style.setProperty('--p', total ? done / total : 0);
        if (text) text.textContent = total ? `${done} of ${total} exercises done` : '';
      });
      const resetB = document.querySelector('[data-progress-reset]');
      if (resetB) resetB.addEventListener('click', () => { progress.reset(); });
    });
  }

  Go.ui = { BoardView, explore, replay, pickPoints, choice, puzzle, puzzleSet, captureGame, fullGame, friendGame, countQuiz, progress, initLesson, libMarks };
})();
