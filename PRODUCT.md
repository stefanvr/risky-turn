# Risky Turn

## Intent
A turn-based conquer-the-map strategy game for a mobile web browser: the Risk
genre, not a port of it. Players reinforce and attack until one holds the map,
with two mechanics of this game's own — bombers, which strike at range without
taking ground, and defensive lines, which harden a territory a full round after
they are declared. A round needs only a phone and a few minutes of attention.

## Decided
- It is played on a phone held in one hand. Touch is the only input, and a thumb
  has to be able to reach and hit everything the game asks for.
- A player opens a link and plays. There is nothing to install, no account to
  make, and nobody to wait for.
- Risky Turn is a game of the Risk genre shaped for a phone, not a port of Risk.
  Its skeleton is Risk's — territories, continents, dice combat, victory by
  conquest — and any rule that fights a short hot-seat session on a small screen
  is changed deliberately and recorded rather than inherited.
- The game is played on one fixed, hand-authored world in the classic style:
  territories grouped into continents that pay a reinforcement bonus to a player
  holding one outright. Worlds are not generated, and there is no world to
  choose.
- The world is invented, with names of its own rather than Earth's, and laid out
  portrait so an upright phone shows the whole board at once. Continents meet
  only at narrow necks, and the water between them is crossed by named sea links
  that only bombers use.
- Players share one device and take turns in sequence. There is no computer
  opponent and no network play: the game is passed from hand to hand. Because
  some of what a player knows is secret, ending a turn covers the board until
  the next player takes it up.
- The screen states at all times whose turn it is, in that player's own colour,
  and what the turn still owes. What just happened is reported separately and
  never displaces it: on a shared phone, the standing question and the last
  event are two different things and need two places.
- The game's numbers are reachable from the board. A legend states what a turn
  earns, what each continent pays and what each unit costs, so a player never
  has to know a rule from outside the game to play it.
- Each continent's coast is drawn in a colour of its own, and pulled inside its
  own ground so that two continents meeting at a neck show both their lines.
  Borders between cells wear one colour everywhere.
- A control that belongs to one phase of a turn hides when its phase ends but
  keeps its place on screen. The map is the same size in the same position for
  the whole turn, so nothing a thumb is already reaching for moves under it.

## Deferred
- 2026-09-20 — Escalation. Nothing currently forces a game to end: income is
  near flat and the defender takes ties, so a dug-in position is cheap to hold
  and expensive to take. Deferred in favour of bombers and defensive lines,
  which change the same arithmetic from the other side — one makes stacks
  reachable without taking ground, the other makes them worth building.
  Revisit once a full game has been played.
- 2026-09-20 — The opening. Territories are dealt at random and opening armies
  are spread automatically, so the first decision a player makes is several
  turns into the game. Deferred for the same reason.
- 2026-09-21 — The numbers a game is balanced on stand at their current values
  until a full game has been played: what a bomber costs and what its die kills
  on, how far a bomber reaches, what a defensive line costs to hold and how long
  it takes to harden, how many armies open a game, and what each continent pays.
  None of them can be judged from a screenshot; they need a game. They stay
  PROVISIONAL where they are defined.
- 2026-09-21 — Both automatic movements stand: on taking a territory the
  attacker advances with everything but one army, and a fortify moves everything
  that can leave. Each trades a real choice for a gesture that is faster on a
  phone, and the trade is only worth judging once a game has been played
  through. PROVISIONAL in src/domain/turn.ts and src/ui/game.ts.
- 2026-09-21 — The look stands as it is until a styling session takes it up as
  one piece: the palette, the six player colours, the six continent coasts and
  the accent that marks a poised strike. Colours settled one at a time do not
  survive being seen together, and six distinguishable player colours sitting on
  the map is the constraint the whole palette has to meet. All PROVISIONAL in
  src/styles.css.
