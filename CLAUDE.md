# First Moves in Go — project guide

Interactive HTML lessons teaching the board game Go. Lessons 1–4 were published on 2026-11-01 and lessons 5–8 on 2026-11-02.

## Audience and decisions already made

- Readers: very smart, intellectually mature boys, roughly 11–14 (one of them is Sebastian), with no Go experience but good experience of chess, Civilization 6 and Polytopia. Each boy uses the lessons on his own, not two at one screen.
- Teach Go as a strategy game for players who already think strategically. Lessons include callouts labelled "If you play chess" and "If you play Civilization or Polytopia" that point out which instincts help and which mislead.
- Scoring: area scoring (Chinese rules), komi 7.5. Territory scoring is explained once, in a short box in Lesson 4.
- Board positions are always drawn by code, never by an image generator. Generated images are used only for the hero illustrations (ink-wash style, made with gpt-image-2, in `assets/`).
- The user's global writing rules apply to every word a child reads: complete sentences, no shorthand, and every instruction says exactly what to do and where it stops.

## Where things live

- **Main copy: claude.ai artifacts** (Andres decided this on 2026-11-01). Send learners the home page: https://claude.ai/artifact/3DMxoQgME51Fg9tnQe3NET. Every page's artifact URL is in `links.json` (gitignored, keys `INDEX`, `L1`…`L8`, `PLAY`). Index, lessons 1–4 and Play a Friend are set to "Anyone with the link" (lessons 5–8 were published private on 2026-11-02; Andres was asked to share them); a newly published artifact starts private and Andres must share it from its Share menu (Claude cannot change sharing), so tell him whenever a new page is published.
- Mirror: GitHub Pages at https://andressolve.github.io/first-moves-in-go/, from the public repo https://github.com/andressolve/first-moves-in-go (branch `main`, serves `docs/`). Keep it in sync, but the artifacts come first.

## Files

- `src/go-engine.js`: rules (capture, suicide, simple ko), capture reading (`attack`, `defend`, `bestResistance`), area and territory scoring, the Capture Go bot (`captureBotMove`) and the Monte Carlo bot for full games (`mcMove`, `estimate`, `guessDead`). It has no DOM code, so it runs under Node.
- `src/go-ui.js`: the SVG board (`BoardView`) and the widgets under `Go.ui`: `explore`, `replay`, `pickPoints`, `choice`, `puzzle`, `puzzleSet`, `captureGame`, `fullGame`, `friendGame` (two players on one screen, 9×9/13×13/19×19, komi, handicap, scoring, unfinished game saved in localStorage), `countQuiz`, plus progress tracking (`initLesson`, saved in localStorage per lesson).
- `src/lesson.css`: shared styles with light and dark themes.
- `src/lesson-N.html`, `src/index.html` and `src/play.html` (the Play a Friend page): page sources. `<!--HEAD-->` is replaced by fonts, CSS and JS; `<!--HERO-->` by the lesson's illustration; `{{L1}}`…`{{L8}}`, `{{INDEX}}` and `{{PLAY}}` by links.
- `build.py`: bundles every page into one self-contained HTML file in `docs/`.
- `tests/verify-lesson.js`: loads a lesson's widget specs and checks every puzzle against the engine (answers legal and capturing, kill and save puzzles having exactly the intended solutions, replays legal).
- `tests/ui-click.test.js`: clicks through a built page in headless Chrome, running a script such as `tests/l1-clicks.js` or `tests/play-clicks.js` (example: `node tests/ui-click.test.js docs/play.html tests/play-clicks.js`). It needs `puppeteer-core`; install it somewhere and pass its path in the `PUPPETEER` environment variable.

## Workflow for a change

1. Edit files in `src/`.
2. Run `node tests/verify-lesson.js src/lesson-N.html` until it reports "All checks passed". Check any extra claim in the text (stone counts, scores, ladder results) with a short Node script against the engine.
3. Run `python3 build.py`. It writes `publish/` (artifact bodies with artifact links) and `docs/` (GitHub Pages files with relative links).
4. Republish every changed page from `publish/` to its existing artifact URL (pass `url` from `links.json` when working in a new session). For a new page: publish it, add its URL to `links.json`, rebuild, and republish every page so all the top bars link to it.
5. Commit `src/` and `docs/` together and push, so the GitHub Pages mirror stays in sync.

## Writing puzzles

- Puzzle modes: `answers` (one-move problems), `tree` (multi-move lines with scripted replies), `mode: 'kill'` or `mode: 'save'` with a `target` (judged by the capture reader), or a custom `judge` function.
- The capture reader understands ladders, nets and simple capturing races. It does not understand life and death, so life-and-death puzzles must use `tree` with every line checked by hand.
- Known gap: when the defender ignores a threat, `defend` only lets the attacker try atari moves, so a net needed deeper in a line is not found. Current puzzles are not affected; check new net puzzles carefully.
- Ids passed as `checkpoint`, and `idPrefix` for games, must be unique within a page.

## Next steps (planned lesson sequence)

Done: 5 The Opening, 6 Cutting and Connecting, 7 Sente and Gote, 8 Life-and-Death Shapes.

9. Invading and reducing territory.
10. Endgame move values.
11. Moving up to 19×19.
12. Reviewing your own games.

When adding a lesson, also add its tab to the top bar of every page, a card on `src/index.html` (and remove it from "Coming later"), a line in the rule reminders on `src/play.html`, the lesson range in `build.py` (`range(1, 9)` now), its key in `links.json`, and an illustration in `assets/hero-N.jpg` with alt text in `assets/hero-N.txt`. On phones (under 640 px) the tab row scrolls sideways and starts centred on the current page, so the sticky top bar stays one row.

Life-and-death puzzles have an exhaustive solver: `node tests/verify-ld.js src/lesson-8.html` (solver in `tests/ld-solver.js`). Each problem carries an `ld: {target, wall}` field that the page ignores and the solver reads. Run it whenever lesson 8 puzzles change, and use it for new life-and-death problems, because `verify-lesson.js` only checks that tree moves are legal.

## Illustrations for new lessons

Generate each hero image with the OpenAI image API (model `gpt-image-2`, key in `OPENAI_API_KEY`) at 1536×1024. Then shrink it to 900 px wide and under about 150 KB with `sips`, and save it as `assets/hero-N.jpg`, with a one-sentence alt text in `assets/hero-N.txt`. Keep the style of lessons 1–4: an ink-and-wash (sumi-e) illustration in black ink, warm kaya-wood gold and a little deep jade green, on textured paper, with lots of quiet space and no text, letters, logos or faces. Never show a readable Go board position; use a metaphor instead (lesson 2 is a zigzag mountain path ending at a cliff, lesson 4 is fields enclosed by stone walls). Look at every image before using it.

## How lessons were built (a pattern that worked for 1–4 and 5–8)

- One builder agent per lesson ran in parallel. Each one wrote only its own `src/lesson-N.html`, verified every puzzle with `tests/verify-lesson.js` and extra Node checks, and reported any change it wanted in the shared files instead of making it. The main session then made those shared changes.
- Before publishing, every page was checked in headless Chrome for page errors, for overflow at a 390 px phone width, and with click-through scripts. Use Chrome's real viewport through puppeteer for the phone-width check: a plain `--window-size=400` screenshot falsely shows overflow, because headless Chrome has a minimum window width.

The built-in 9×9 opponent is weak: flat Monte Carlo with 1,000, 3,000 or 10,000 playouts. Once learners outgrow it, point them to online-go.com (OGS).
