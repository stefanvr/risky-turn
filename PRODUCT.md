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
- The game is published as a static site to GitHub Pages at
  https://stefanvr.github.io/risky-turn/ on every push to main. There is no
  server and no account: a player opens a URL. A build that fails the check is
  never published.

## Where decided truth lives
- what a map must satisfy to be playable -> src/domain/map.ts
- published URL and asset base -> vite.config.ts, .github/workflows/deploy.yml
- palette and type tokens -> src/styles.css

## Deferred
- 2026-09-20 — The palette is not settled. It stays PROVISIONAL in
  src/styles.css until players have colours, because six distinguishable player
  colours sitting on the map is the constraint the palette actually has to
  survive, and that does not exist yet.
