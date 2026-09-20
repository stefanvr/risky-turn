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
| `found-line` | The opponent holds a defensive line on Bravo, already discovered, garrisoned and rolling three dice. |
| `bombers-vs-line` | The interlock: the opponent is dug in on Echo across water no army can cross, and a squadron of three sits on Alfa that can reach it anyway. |

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
