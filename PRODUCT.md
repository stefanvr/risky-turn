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
- A player opens a link and plays. There is nothing to install and no account to
  make.
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
- There are two ways to play, chosen when the game is opened: players share one
  device and pass it from hand to hand, or each player plays on their own device
  in a match they join by a code. There is no computer opponent either way.
- Some of what a player knows is secret, and a player is never shown what they
  may not know. On a shared device that means the board is covered between
  turns, because the next player is about to hold it. On a player's own device
  there is nobody to hide it from, so the board stays up through everyone's
  turns and shows the match as it happens, told only what that player knows.
- A match can be read back. What has happened during play is available to a
  player while they play, reached the same way the game's numbers are.
- Opening the game asks which way it is being played before it deals a board:
  sharing one device, or playing on separate ones. The online way arrives
  already holding a six-digit code — one player reads it out, the other types
  it in — and joining is offered beneath that rather than as a second decision
  every player has to make.
- A match depends on the player who started it. If they leave, it ends for
  everyone: there is no handing a match on to somebody else and no waiting for
  its owner to come back.
- A match between players on their own devices is carried by the game's own
  service, not by a connection the two devices make to each other. A match
  therefore works wherever the game itself can be reached, and a player is
  never told that their network is the reason they cannot play. What this
  costs is that everything a match says passes through that service, where
  whoever runs it can read it; what a player may not know is still never sent
  to them.
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
- A tap on the board chooses; it does not spend. The action a phase offers has
  its own control, named after what pressing it does, and it is offered only
  where the rules would allow it. Where a second tap on a chosen territory
  still means something — arming a squadron during an attack — it commits
  nothing by itself: the tap that commits is the one that names the target.
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
  the map is the constraint the whole palette has to meet. The front door's
  look joins this: it is the first screen a player meets and nothing about its
  weight, spacing or emphasis has been chosen. All PROVISIONAL in
  src/styles.css.
- 2026-09-21 — Making gameplay traffic hard to read casually. A match's messages
  stay plain and descriptive rather than compact and opaque. The game sends
  roughly one message per player action, so a compact encoding saves nothing
  worth an encoder, a decoder and a schema to keep in step, and the obscurity it
  would buy is no defence against anyone determined. Revisit only if a message
  ever becomes frequent.
- 2026-09-21 — Matches of more than two players. A match is two players until
  the two-player path works end to end. Eight is a product question of its own
  before it is a technical one — thirty territories split eight ways is three
  or four each, and there are six player colours — and none of that can be
  judged before a networked match has been played at all.

