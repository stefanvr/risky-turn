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
| One call resolves one exchange; pressing an attack is repeated | `src/domain/turn.ts` | inherited |
| Attack needs: own source, enemy target, shared border, 2+ armies | `src/domain/turn.ts` | inherited |
| On conquest the attacker advances with all but one army | `src/domain/turn.ts` | **deviation**, deferred |
| One fortify per turn | `src/domain/turn.ts` | inherited |
| Fortify travels any path through the player's own territory | `src/domain/turn.ts` | inherited (one of Risk's own variants) |
| A fortify moves all but one army | `src/ui/game.ts` | **deviation**, PROVISIONAL |
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

## The question this raises

Risky Turn is played on a phone, in hot-seat, by players passing one device.
Risk's rules were written for a table, an afternoon, and players who cannot put
the board in their pocket. Three of the inherited rules are in direct tension
with that setting:

1. **No escalation.** Risk without cards does not reliably end.
2. **One tap-pair per dice exchange.** Taking a six-army territory can cost a
   dozen taps, each one a separate decision the player did not want to make.
3. **A full turn has three phases**, two of which are usually skipped, and each
   handover passes the device.

Whether these are problems depends on an unsettled question: is Risky Turn
meant to be Risk on a phone, or a game of the Risk genre shaped for a phone?
That is a product decision, not an implementation one.
