# Risky Turn

A turn-based conquer-the-map strategy game for a mobile web browser. Players
share one phone and take turns reinforcing and attacking until one of them
holds the map.

Play it: **https://stefanvr.github.io/risky-turn/**

## Running it

```sh
pnpm install
pnpm dev        # development server, with fixtures
pnpm check      # typecheck, production build, then tests — the gate for every goal
```

`docs/development.md` covers the rest: repainting the world, taking pictures of
the board in a real browser, reproducing a game from its seed, and putting a
position on the board on purpose.

## Where the code lives

| | |
|---|---|
| `src/domain/` | the rules, as plain data and pure functions — no DOM |
| `src/maps/` | the world the game is played on |
| `src/render/` | the board as a picture |
| `src/ui/` | what a turn looks and feels like in the hand |
| `src/dev/` | fixtures and pictures, dropped from production builds |
| `scripts/` | the world-painter, and the board screenshotter |

## Where decided truth lives

Nothing below is restated anywhere else. When two answers disagree, the one
named here is the one that holds.

| question | answer lives in |
|---|---|
| what this is for, and what it means to a player | `PRODUCT.md` |
| how it is built, hosted and published | `docs/architecture.md` |
| which of Risk's rules are kept, changed or dropped | `docs/rules.md` |
| how to run it, picture it, reproduce a game, reach fixtures | `docs/development.md` |
| what a world must satisfy to be playable | `src/domain/map.ts`, `src/maps/world.test.ts` |
| the board the game is played on | `src/maps/world.ts` |
| what the board says about a continent | `src/render/coast.ts` |
| the rules of a turn, and what makes a move illegal | `src/domain/turn.ts` |
| what one player may be told about the board | `src/domain/view.ts` |
| how a match is hosted, and what a seat may ask for | `src/match/match.ts` |
| how many armies a turn grants | `src/domain/reinforcements.ts` |
| how a battle is decided | `src/domain/combat.ts` |
| what a cell shows, what the turn bar says, what the legend lists | `src/ui/presentation.ts` |
| palette and type tokens | `src/styles.css` |

## What is still open

`grep -rn PROVISIONAL` is the list of decisions taken by default rather than by
choice. It is the whole of the tracking; there is no other list.
