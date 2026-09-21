# Architecture

The technical rules this project holds to, and the choices behind them. Product
meaning lives in `PRODUCT.md` and is written without any of this; how to run
and inspect the thing lives in `docs/development.md`.

## Shape

A static site. The whole game is in the page: a player opens a URL and plays,
no account is made, no game is stored, and nothing of a game survives a reload.
This is what makes "nothing to install, no account to make" true, and it is the
constraint every other choice here answers to.

A match between players on their own devices needs something a page cannot
supply by itself: somewhere both browsers can reach. Firebase is that place,
and it carries the whole match — identity, rooms, join codes and every message
of play. There is no peer connection and no TURN relay to pay for: two browsers
that can reach the database can play, which is the case a direct connection
between two mobile networks most often is not. No backend credential or service
account is present in browser code; anonymous sign-in and the security rules
are the whole of the boundary.

What this costs is a round trip per action, which a turn-based game does not
feel, and gameplay that is legible to whoever runs the project. What it buys is
one transport: no fallback path, no second implementation, and no class of
player who cannot play.

A room is the match. It holds the two players and two lists of messages, one
per side: each side appends to its own and reads the other's, and a message
cannot be amended or withdrawn once written. The room lives as long as the
match does. Clearing it is the host's alone — which is what makes "a match
depends on the player who started it" true of the data as well as the rules —
and the database is told at the moment the room is made to clear it when the
host's connection drops, because there is no server to sweep up afterwards. A
guest who leaves takes only their own place, which is how the host learns they
are gone.

Each side writes only under its own name and reads only the other's list, so
the redaction in `src/domain/view.ts` is what a player receives, exactly as it
was over a direct connection: the host sends one player's view to that player's
list and nowhere else. `database.rules.json` is the boundary between one match
and another, and is the only thing standing between a guessed six-digit code
and somebody else's game. The rules are published to the live project by hand;
the Pages workflow carries the site and nothing else, so a rule changed here is
not a rule in force until it is published.

Published to GitHub Pages at `https://stefanvr.github.io/risky-turn/` on every
push to `main`. The asset base and the workflow are the authority for the URL —
`vite.config.ts` and `.github/workflows/deploy.yml`. A build that fails
`pnpm check` is never published.

## Stack

TypeScript, Vite, Vitest, pnpm. No UI framework: the DOM and the SVG board are
built directly, because the board is one drawing and a framework's reconciler
would earn nothing against it.

## One host, and seats that know only their own player

A match has one authoritative host and one seat per player. The host owns the
game state and is the only thing that applies a move: a seat sends an action,
the host validates it and applies it, and the seat is sent back what its player
may know. A seat decides nothing.

Hot-seat is a match with one seat. The rules, the redaction and the handover
therefore have one implementation and cannot disagree about a game played two
ways.

Secrecy is enforced where the state is sent, not where the board is drawn
(`src/domain/view.ts`). A seat is never given what its player may not know,
because anything delivered to a browser must be assumed readable by whoever
holds it — and a defensive line is secret by rule, not by obscurity.

The transport is an interface. A loopback transport runs a whole match in one
process, which is how authority and secrecy are checked without a network.

## The domain owns the rules, and knows nothing else

A game is a value. `src/domain/` holds plain data and pure functions, and every
rule is a function from one state to the next. It imports no DOM, no renderer
and no UI.

`src/render/` and `src/ui/` read that state and never own it. A rule that lives
in the UI is a bug in the making: it cannot be tested against a position, and it
disagrees with the domain the moment either moves.

Randomness enters through a seed (`src/domain/random.ts`), so any game can be
replayed exactly — which is what makes a dice-driven game testable at all.

## The numbers are stated once

The legend a player reads is built from the rules themselves
(`src/ui/presentation.ts`), never written out a second time. A constant changed
in `src/domain/` changes what the board says about it, with nothing to keep in
sync.

The same rule applies to documents: a document states a rule, the code holds the
instance. `PRODUCT.md` says the world is portrait and its continents meet at
narrow necks; that it is thirty territories in six continents is asserted by
`src/maps/world.test.ts`, and stated nowhere else.

## The world is painted, not typed

`src/maps/world.ts` is generated by `scripts/paint-world.py`, which holds the
world as a character grid and derives shapes, borders and coasts from it. Two
territories therefore cannot disagree about the border between them. See
`docs/development.md` for the loop.

## Evidence

`pnpm check` — typecheck, production build, then tests — is the gate for every
goal, and it builds before it tests because one test reads the built bundle.

jsdom paints nothing, so a change a player can see is checked against a picture
taken from the real page in a real browser (`scripts/board-shot.mjs`,
`src/dev/picture.test.ts`), not only against the marks in the DOM.

Fixtures and the picture tooling live in `src/dev/` behind `import.meta.env.DEV`,
so a production build folds them away and ships neither.
