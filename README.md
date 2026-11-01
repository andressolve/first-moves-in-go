# First Moves in Go

Interactive lessons that teach the board game Go to players who already know chess and strategy games such as Civilization and Polytopia. Every board in the lessons is a working Go board: readers step through animations, solve puzzles that explain why a wrong answer fails, and play against a computer opponent.

## Lessons

1. Liberties and Capture
2. Ladders and Nets
3. Suicide and Ko
4. Life and Territory

## How the project is organised

- `src/` holds the lesson pages, the Go engine (`go-engine.js`), the board and widget code (`go-ui.js`) and the shared styles (`lesson.css`).
- `assets/` holds the illustration at the top of each lesson.
- `build.py` bundles each lesson into a single self-contained HTML file in `docs/`, which is the site GitHub Pages serves.
- `tests/verify-lesson.js` checks every puzzle in a lesson against the engine. Run it with `node tests/verify-lesson.js src/lesson-1.html`.

After editing anything in `src/`, run `python3 build.py` and commit the updated `docs/` folder.
