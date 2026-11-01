# First Moves in Go — project guide

Interactive HTML lessons teaching the board game Go. Lessons 1–4 were finished and published on 2026-11-01.

## Audience and decisions already made

- Readers: very smart, intellectually mature boys, roughly 11–14 (one of them is Sebastian), with no Go experience but good experience of chess, Civilization 6 and Polytopia. Each boy uses the lessons on his own, not two at one screen.
- Teach Go as a strategy game for players who already think strategically. Lessons include callouts labelled "If you play chess" and "If you play Civilization or Polytopia" that point out which instincts help and which mislead.
- Scoring: area scoring (Chinese rules), komi 7.5. Territory scoring is explained once, in a short box in Lesson 4.
- Board positions are always drawn by code, never by an image generator. Generated images are used only for the hero illustrations (ink-wash style, made with gpt-image-2, in `assets/`).
- The user's global writing rules apply to every word a child reads: complete sentences, no shorthand, and every instruction says exactly what to do and where it stops.

## Where things live

- Public site (send this link to learners): https://andressolve.github.io/first-moves-in-go/
- Repo: https://github.com/andressolve/first-moves-in-go (public, branch `main`). GitHub Pages serves the `docs/` folder.
- Private claude.ai copies also exist (home page https://claude.ai/artifact/3DMxoQgME51Fg9tnQe3NET). Their URLs are in `links.json`, which is gitignored; `python3 build.py` writes artifact-ready bodies to `publish/` (also gitignored). The GitHub Pages site is the version to share, because each artifact has to be shared by hand.

## Files

- `src/go-engine.js`: rules (capture, suicide, simple ko), capture reading (`attack`, `defend`, `bestResistance`), area and territory scoring, the Capture Go bot (`captureBotMove`) and the Monte Carlo bot for full games (`mcMove`, `estimate`, `guessDead`). It has no DOM code, so it runs under Node.
- `src/go-ui.js`: the SVG board (`BoardView`) and the widgets under `Go.ui`: `explore`, `replay`, `pickPoints`, `choice`, `puzzle`, `puzzleSet`, `captureGame`, `fullGame`, `countQuiz`, plus progress tracking (`initLesson`, saved in localStorage per lesson).
- `src/lesson.css`: shared styles with light and dark themes.
- `src/lesson-N.html` and `src/index.html`: page sources. `<!--HEAD-->` is replaced by fonts, CSS and JS; `<!--HERO-->` by the lesson's illustration; `{{L1}}`…`{{L4}}` and `{{INDEX}}` by links.
- `build.py`: bundles every page into one self-contained HTML file in `docs/`.
- `tests/verify-lesson.js`: loads a lesson's widget specs and checks every puzzle against the engine (answers legal and capturing, kill and save puzzles having exactly the intended solutions, replays legal).
- `tests/ui-click.test.js`: clicks through a built page in headless Chrome. It needs `puppeteer-core`; install it somewhere and pass its path in the `PUPPETEER` environment variable.

## Workflow for a change

1. Edit files in `src/`.
2. Run `node tests/verify-lesson.js src/lesson-N.html` until it reports "All checks passed". Check any extra claim in the text (stone counts, scores, ladder results) with a short Node script against the engine.
3. Run `python3 build.py`.
4. Commit `src/` and `docs/` together and push. The site updates in a minute or two.

## Writing puzzles

- Puzzle modes: `answers` (one-move problems), `tree` (multi-move lines with scripted replies), `mode: 'kill'` or `mode: 'save'` with a `target` (judged by the capture reader), or a custom `judge` function.
- The capture reader understands ladders, nets and simple capturing races. It does not understand life and death, so life-and-death puzzles must use `tree` with every line checked by hand.
- Known gap: when the defender ignores a threat, `defend` only lets the attacker try atari moves, so a net needed deeper in a line is not found. Current puzzles are not affected; check new net puzzles carefully.
- Ids passed as `checkpoint`, and `idPrefix` for games, must be unique within a page.

## Next steps (planned lesson sequence)

5. The opening on 9×9: corners, then sides, then the centre.
6. Cutting and connecting.
7. Sente and gote (initiative).
8. Common life-and-death shapes.
9. Invading and reducing territory.
10. Endgame move values.
11. Moving up to 19×19.
12. Reviewing your own games.

When adding a lesson, also add its tab to the top bar of every page, a card on `src/index.html`, a `{{L5}}` link entry in `build.py`, and an illustration in `assets/hero-5.jpg` with alt text in `assets/hero-5.txt`.

The built-in 9×9 opponent is weak: flat Monte Carlo with 1,000, 3,000 or 10,000 playouts. Once learners outgrow it, point them to online-go.com (OGS).
