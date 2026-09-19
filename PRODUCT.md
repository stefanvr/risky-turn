# Risky Turn

## Intent
A turn-based conquer-the-map strategy game in the Risk genre, played in a mobile
web browser. Players claim territories, reinforce them, and attack neighbours
until one holds the map. It is worth building because the genre's appeal is
sustained, and no round needs more than a phone and a few minutes of attention.

## Decided
- Delivery is a web application, playable on a mobile device. Touch input and a
  phone-sized viewport are the primary target, not an afterthought.
- The game is played on one fixed, hand-authored world map in the classic style:
  territories grouped into continents that grant a reinforcement bonus to a
  player holding all of them. Maps are not generated, and there is no map
  selection.

## Where decided truth lives
- what a map must satisfy to be playable -> src/domain/map.ts
- palette and type tokens -> src/styles.css

## Deferred
- 2026-09-20 — The palette is not settled. It stays PROVISIONAL in
  src/styles.css until players have colours, because six distinguishable player
  colours sitting on the map is the constraint the palette actually has to
  survive, and that does not exist yet.
