# Risky Turn

## Intent
A turn-based conquer-the-map strategy game for a mobile web browser: the Risk
genre, not a port of it. Players reinforce and attack until one holds the map,
with two mechanics of this game's own — bombers, which strike at range without
taking ground, and defensive lines, which harden a territory a full round after
they are declared. A round needs only a phone and a few minutes of attention.

## Decided
- Delivery is a web application, playable on a mobile device. Touch input and a
  phone-sized viewport are the primary target, not an afterthought.
- The game is played on one fixed, hand-authored world map in the classic style:
  territories grouped into continents that grant a reinforcement bonus to a
  player holding all of them. Maps are not generated, and there is no map
  selection.
- The game is published as a static site to GitHub Pages at
  https://stefanvr.github.io/risky-turn/ on every push to main. There is no
  server and no account: a player opens a URL. A build that fails the check is
  never published.
- Risky Turn is a game of the Risk genre shaped for a phone, not a port of
  Risk. Its skeleton is Risk's — territories, continents, dice combat, victory
  by conquest — and any rule that fights a short hot-seat session on a small
  screen is changed deliberately and recorded rather than inherited.
- The world is thirty territories in six continents, an invented world with
  names of its own rather than Earth, laid out portrait so an upright phone
  shows the whole board at once. Continents meet only at narrow necks, and the
  water between them is crossed by named sea links that only bombers use.
- Players share one device and take turns in sequence. There is no computer
  opponent and no network play: the game is passed from hand to hand. Because
  some of what a player knows is secret, ending a turn covers the board until
  the next player takes it up.

## Where decided truth lives
- which of Risk's rules are kept, changed or dropped -> docs/rules.md
- how to run it, reproduce a game, and reach fixtures -> docs/development.md
- what a map must satisfy to be playable -> src/domain/map.ts
- the board the game is played on -> src/maps/world.ts
- what the board says about a continent -> src/render/coast.ts
- the rules of a turn, and what makes a move illegal -> src/domain/turn.ts
- how many armies a turn grants -> src/domain/reinforcements.ts
- how a battle is decided -> src/domain/combat.ts
- published URL and asset base -> vite.config.ts, .github/workflows/deploy.yml
- what a cell shows about its forces and its state -> src/ui/presentation.ts
- palette and type tokens -> src/styles.css

## Deferred
- 2026-09-20 — The palette is not settled. It stays PROVISIONAL in
  src/styles.css until players have colours, because six distinguishable player
  colours sitting on the map is the constraint the palette actually has to
  survive, and that does not exist yet.
- 2026-09-20 — Player colours are placeholders, one token per player in turn
  order, PROVISIONAL in src/styles.css alongside the palette. They read clearly
  enough to play with and are deliberately not settled yet.
- 2026-09-20 — On taking a territory the attacker advances with everything but
  one army, rather than being asked how many to move. It stays PROVISIONAL in
  src/domain/turn.ts. The choice is real tactical depth, but a second dialog in
  the middle of an attack is real friction on a phone, and the trade-off is
  easier to judge once a turn can actually be played.
