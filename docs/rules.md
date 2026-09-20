# Rules: what is decided, and what was merely inherited

The code is the authority for what each rule *does*; this file records only
where each rule came from and what is still open. A rule marked **inherited**
was taken from Risk because it was the obvious default while building the
mechanism, not because it was chosen for this game. A rule marked **invented**
was made up on the spot for the same reason. Neither has been argued for.

| rule | where | provenance |
|---|---|---|
| Territories dealt out at random, as evenly as they divide | `src/domain/setup.ts` | invented — Risk has players claim territories in turn |
| One army on each held territory, the rest spread round-robin | `src/domain/setup.ts` | invented |
| Opening armies = twice the largest territory share | `src/domain/setup.ts` | invented, PROVISIONAL |
| Turn order is the order players were listed | `src/domain/setup.ts` | invented — Risk rolls for it |
| Reinforcements = max(3, territories ÷ 3) | `src/domain/reinforcements.ts` | inherited |
| Continent bonus for holding a continent outright | `src/domain/reinforcements.ts` | inherited |
| Attacker rolls up to 3 dice, one per army beyond the first | `src/domain/combat.ts` | inherited |
| Defender rolls up to 2 dice, one per army | `src/domain/combat.ts` | inherited |
| Dice sorted and paired highest-first; defender takes ties | `src/domain/combat.ts` | inherited |
| Six-sided dice | `src/domain/dice.ts` | inherited |
| One call resolves one exchange; pressing an attack is repeated | `src/domain/turn.ts` | **decided** — the tension of each roll is the point, and is worth the taps |
| Attack needs: own source, enemy target, shared border, 2+ armies | `src/domain/turn.ts` | inherited |
| On conquest the attacker advances with all but one army | `src/domain/turn.ts` | **deviation**, deferred |
| One fortify per turn | `src/domain/turn.ts` | inherited |
| Fortify travels any path through the player's own territory | `src/domain/turn.ts` | inherited (one of Risk's own variants) — rewards a connected empire, which pairs with continent bonuses |
| A fortify moves all but one army | `src/ui/game.ts` | **deviation**, PROVISIONAL |
| Ending a turn covers the board until the next player takes it up | `src/ui/game.ts` | **decided** — secret lines need a handover on a shared device |
| Turn runs deploy, then attack, then fortify | `src/domain/game.ts` | inherited |
| Every reinforcement must be placed before the phase ends | `src/domain/turn.ts` | inherited |
| A player holding nothing is skipped | `src/domain/turn.ts` | inherited |
| Last player holding territory wins | `src/domain/turn.ts` | inherited |

## Rules of Risk that are absent, by omission rather than decision

- **Cards and set trading.** In Risk this is the engine that escalates income
  and forces games to end. Without it, reinforcement income is close to flat,
  and since the defender wins ties, a dug-in position is cheap to hold and
  expensive to take. Nothing currently pushes a stalemate towards a conclusion.
- **An opening claim or draft phase.** Players never choose where they start.
- **Any objective other than total conquest.** Risk's mission variants end far
  sooner than world domination does.
- **Taking an eliminated player's cards**, which follows from having no cards.

## The settled position

Risky Turn is a game of the Risk genre shaped for a phone, not a port of Risk
(`PRODUCT.md`). An inherited rule therefore has to earn its place against a
ten-to-twenty-minute hot-seat session on a small screen; where it cannot, it is
changed deliberately and the change is recorded here.

Tapping is the exception already argued: one tap-pair resolves one dice
exchange, and pressing an attack home costs many taps. That cost is accepted,
because the decision to roll again is the tension the genre runs on.

## Deliberately deferred

**Escalation.** Nothing currently forces a game to end: income is near flat and
the defender takes ties, so a dug-in position is cheap to hold and expensive to
take. Deferred on 2026-09-20 in favour of bombers and defensive lines, which
change the same arithmetic from the other side — one makes stacks reachable
without taking ground, the other makes them worth building. Revisit once both
exist and a full game has been played.

**The opening.** Territories are dealt at random and opening armies are spread
automatically, so the first decision a player makes is several turns in.
Deferred on 2026-09-20 for the same reason.

## Rules of Risky Turn's own

Two mechanics that are not Risk's, both implemented. They are written here in
full because they are the first rules this game owns outright, and because they
interlock: a defensive line makes a stack
expensive to take by ground, and bombers are how a stack is reached without
taking ground. Bomb a line's garrison below its threshold and the line
collapses.

### Bombers

A bomber is a unit standing in a territory alongside armies. It projects force
at range and takes no ground.

- **Bought during deploy.** Spend reinforcements to build one bomber in a
  territory you hold, instead of placing those armies.
- **A bomber is not an army.** It never defends, never counts toward a
  territory's strength, and never counts toward reinforcement income. Every
  rule written in terms of armies ignores bombers entirely.
- **Bombers are lost with the ground they stand on.** Conquering a territory
  destroys the bombers in it; they are never captured.
- **A bombing run is an attack-phase action.** Choose a territory of yours
  holding bombers and a target in reach. Every bomber in that territory rolls
  one die, and each 5 or 6 removes one enemy army. The defender does not roll
  back and no bomber is ever lost to the run.
- **Reach** is two borders or fewer, or one sea link. Sea links are edges that
  only bombers may use; ground attacks and fortifies ignore them.
- **A bombing run never takes a territory below one army.** This is what
  "cannot conquer" means in play, and it keeps the guarantee that every
  territory has an owner with something standing on it.
- **Each bomber flies once per turn.** Without this a single bomber would grind
  any territory down to one army in a single phase.

### Defensive lines

A defensive line is a territory dug in: slow to prepare, hard to take, and
visible to opponents while it is being built.

- **Declared during the fortify phase**, on one territory you hold with at
  least five armies, and it consumes that turn's fortify. A player digs in or
  manoeuvres, never both.
- **It takes effect after one full round** — at the end of the declaring
  player's *next* turn. Because lines are secret, this is not a telegraph;
  it is a commitment cost. A player cannot dig in reactively when they see an
  attack coming, so entrenching is a bet placed a turn early.
- **A line is secret.** The phone shows the works of whoever's turn it is and
  nobody else's. An attack that runs into a line reveals it — the extra die is
  visible in the exchange — and it stays on the board for every player from
  then on.
- **While it holds, the defender rolls three dice instead of two**, still
  limited by the armies actually present.
- **It collapses** if the garrison falls below five, or if the player attacks
  out of that territory. A line is for holding ground, not for staging from.
- A player may hold lines on several territories, but builds at most one per
  turn.

### What these cost the model

`Holding` carries a line, a bomber count and whether those bombers have flown,
alongside its owner and armies. A line is a countdown of the holder's own
remaining turns rather than a flag, which needed no global notion of rounds:
the count lives on the territory and is stepped when its holder's turn ends.
The collapse rule lives in `withHolding`, so every path that can thin a
garrison enforces it without having to remember to.

The map gained sea links: a second kind of edge, symmetric like a border,
refused where a land border already runs, and read only by `withinBomberReach`.
A sea link is a destination rather than a road — crossing water does not let a
bomber continue overland on the far side — because one link would otherwise
open up half a map.

Reach is deliberately not a general pathfinder. It is two steps of breadth over
borders, plus a direct sea link, and nothing else.

Open numbers, all PROVISIONAL until a full game has been played: what a bomber
costs in reinforcements, whether reach is two borders, whether 5 and 6 are the
faces that kill, and whether five armies is the right threshold for a line.
