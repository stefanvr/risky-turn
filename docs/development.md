# Development

## Running it

```sh
pnpm install
pnpm dev        # development server, with fixtures
pnpm check      # typecheck, production build, then tests
pnpm preview    # serve the production build
```

`pnpm check` is the gate for every goal. It builds before it tests, because one
of the tests reads the built bundle.

## The world, and how to change it

The board is `src/maps/world.ts`, and it is written rather than typed:
`scripts/paint-world.py` holds the world as a painting, one character per
lattice cell and one character per territory, and derives the rest. Borders
are shared cell edges, so two territories cannot disagree about the coast
between them.

```sh
python3 scripts/paint-world.py   # from the repository root
pnpm check                       # decides whether what was painted is playable
```

`src/maps/world.test.ts` is what "playable" means: every territory reachable
over land, every continent one piece, no two cells overlapping, and — measured
from the SVG the renderer produces — every cell big enough for a thumb and big
enough to hold its own name and forces. Editing `src/maps/world.ts` by hand
works too, but the painting is where a change is cheap.

`src/testing/provingMap.ts` is a five-territory board the rule tests are
written against, small enough that a test can state a whole position in a line.
It is never the board the game is played on.

## Seeing what a change looks like

jsdom paints nothing, so a test can prove a mark is set and still say nothing
about whether it carries. Take a picture instead.

The page, in a real browser, at the size a phone shows it:

```sh
pnpm shot /tmp/board.png
pnpm shot /tmp/legend.png --at "?fixture=found-line&seed=4" \
          --tap '[data-role="legend-open"]'
```

`scripts/board-shot.mjs` starts the development server itself, so seeds and
fixtures work exactly as they do in `pnpm dev`, and `--tap` clicks its way to a
state that takes a tap to reach — placing armies, arming a squadron, opening
the legend. Everything outside the map is in the picture: the turn bar, the
status line, the controls. It needs the browser Playwright installs
(`pnpm exec playwright install chromium`, once).

The map alone, without a browser:

```sh
PICTURE_TO=/tmp/board.svg PICTURE_ARM=cairn pnpm vitest run src/dev/picture.test.ts
# PICTURE_CHOOSE=cairn instead, to choose a cell without arming its squadron
python3 scripts/board-picture.py /tmp/board.svg /tmp/board.png [scale]
```

The first writes out the SVG the renderer actually produced, with a squadron
chosen if `PICTURE_CHOOSE` names a territory, and its squadron armed if
`PICTURE_ARM` does. The second draws it at the size a phone shows the map —
366 by 560 — reading every colour and opacity from `src/styles.css` rather
than restating them, and takes a scale factor for looking closely at a detail.
Letterforms are a 3x5 grid rather than the browser's font, so it answers
layout, contrast and whether a mark carries, not how type looks. Reach for it
when a browser is not available, or when a detail wants magnifying.

## Reproducing a game

The deal is random but seeded, and the seed comes from the address:

```
/risky-turn/?seed=42
```

The same seed always deals the same game, so a position worth looking at twice
can be reached twice — the dice follow from it as well, so a whole sequence of
battles and bombing runs repeats exactly. Without it the clock supplies a seed.
This works in every build, including the published one.

Combined with a fixture, it is how a specific outcome gets looked at:
`?fixture=bombers-vs-line&seed=4` rolls two hits and breaks the line.

## Fixtures: putting a position on the board on purpose

Some positions take many turns to arise, or need an opponent to have made a
particular choice. A fixture places one directly:

```
/risky-turn/?fixture=found-line
```

| fixture | position |
|---|---|
| `found-line` | The opponent holds a defensive line on Harrow, already discovered, garrisoned and rolling three dice. |
| `bombers-vs-line` | The interlock: the opponent is dug in on Calder, and a squadron of three sits on Nale in the Oskan Deep — a march away around half the world, one hop across the water for a bomber. |

Fixtures are built from `newGame` and adjusted through the same `withHolding`
the rules use, so a fixture cannot reach a position the game itself could not,
and it breaks loudly rather than quietly lying if the rules move underneath it.
An unknown fixture name is refused with the list of the names that exist.

### The gate

**Fixtures exist only in a development build.** `src/app.ts` supplies the
resolver behind `import.meta.env.DEV`, so a production build folds it to
`undefined` and the bundler drops `src/dev/fixtures.ts` entirely — the code is
not merely unreachable, it is not there.

`src/dev/gate.test.ts` proves this by reading `dist` and failing if any fixture
string survives. That test has been checked against a deliberately broken gate:
building with the resolver forced on makes it fail, so its passing means
something.

Adding a fixture means adding its name to `fixtureNames()` as well as to the
switch, because the gate test iterates that list.
