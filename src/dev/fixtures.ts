import { newGame } from "../domain/setup";
import { seededRandom } from "../domain/random";
import { withHolding } from "../domain/game";
import type { GameMap } from "../domain/map";
import type { GameState, PlayerId } from "../domain/game";

/**
 * Named positions for looking at a situation on purpose rather than waiting
 * for a deal to produce one.
 *
 * Each fixture starts from a real `newGame` and adjusts it through the same
 * `withHolding` the rules use, so a fixture cannot drift into a state the game
 * itself could never reach — and if the rules change underneath it, it breaks
 * rather than quietly lying.
 */
export type FixtureName = "found-line";

export class UnknownFixtureError extends Error {
  override readonly name = "UnknownFixtureError";
}

export function fixtureNames(): readonly string[] {
  return ["found-line"];
}

export function fixtureNamed(
  name: string,
  map: GameMap,
  players: readonly PlayerId[],
): GameState {
  switch (name) {
    case "found-line":
      return foundLine(map, players);
    default:
      throw new UnknownFixtureError(
        `no fixture named "${name}"; try one of: ${fixtureNames().join(", ")}`,
      );
  }
}

/**
 * The opponent holds a line on Bravo that has already been run into, so it is
 * on the board and rolling three dice. The position a random deal would take
 * many turns to produce.
 */
function foundLine(map: GameMap, players: readonly PlayerId[]): GameState {
  const opponent = players[1]!;
  const opened = newGame(map, players, seededRandom(42));

  return withHolding(opened, "bravo", {
    owner: opponent,
    armies: 8,
    line: { turnsUntilHolding: 0, revealed: true },
  });
}
