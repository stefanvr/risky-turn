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
export type FixtureName = "found-line" | "bombers-vs-line" | "ready-to-dig-in";

export class UnknownFixtureError extends Error {
  override readonly name = "UnknownFixtureError";
}

export function fixtureNames(): readonly string[] {
  return ["found-line", "bombers-vs-line", "ready-to-dig-in", "secret-line"];
}

export function fixtureNamed(
  name: string,
  map: GameMap,
  players: readonly PlayerId[],
): GameState {
  switch (name) {
    case "found-line":
      return foundLine(map, players);
    case "bombers-vs-line":
      return bombersAgainstALine(map, players);
    case "ready-to-dig-in":
      return readyToDigIn(map, players);
    case "secret-line":
      return secretLine(map, players);
    default:
      throw new UnknownFixtureError(
        `no fixture named "${name}"; try one of: ${fixtureNames().join(", ")}`,
      );
  }
}

/**
 * The interlock: the opponent is dug in on Calder, half a world away from the
 * player's squadron on Nale in the Oskan Deep — and one hop across open water,
 * which is the only way anything of the player's reaches it this turn. Two
 * good rolls take the garrison under its threshold and the line falls.
 */
function bombersAgainstALine(map: GameMap, players: readonly PlayerId[]): GameState {
  const player = players[0]!;
  const opponent = players[1]!;
  const opened = newGame(map, players, seededRandom(42));

  let staged = withHolding(opened, "nale", {
    owner: player,
    armies: 3,
    line: null,
    bombers: 3,
    bombersFlown: false,
  });
  staged = withHolding(staged, "calder", {
    owner: opponent,
    armies: 6,
    line: { turnsUntilHolding: 0, revealed: true },
    bombers: 0,
    bombersFlown: false,
  });
  // The position exists to be flown from, and a squadron cannot fly during a
  // deploy: the fixture opens on the phase its point is made in.
  return { ...staged, phase: "attack", reinforcementsLeft: 0 };
}

/**
 * The opponent is dug in on Calder and nobody has run into it yet, so the line
 * is on the board for its holder and on no board but theirs. It is the one
 * position that tells two screens apart: the same cell, two players, two
 * truths.
 */
function secretLine(map: GameMap, players: readonly PlayerId[]): GameState {
  const opponent = players[1]!;
  const opened = newGame(map, players, seededRandom(42));

  const staged = withHolding(opened, "calder", {
    owner: opponent,
    armies: 6,
    line: { turnsUntilHolding: 0, revealed: false },
    bombers: 0,
    bombersFlown: false,
  });
  return { ...staged, phase: "attack", reinforcementsLeft: 0 };
}

/**
 * The opponent holds a line on Harrow that has already been run into, so it is
 * on the board and rolling three dice. The position a random deal would take
 * many turns to produce.
 */
function foundLine(map: GameMap, players: readonly PlayerId[]): GameState {
  const opponent = players[1]!;
  const opened = newGame(map, players, seededRandom(42));

  return withHolding(opened, "harrow", {
    owner: opponent,
    armies: 8,
    line: { turnsUntilHolding: 0, revealed: true },
    bombers: 0,
    bombersFlown: false,
  });
}

/**
 * A turn already down to its fortify, with one territory garrisoned heavily
 * enough to dig in. It is the position the fortify phase's own control is
 * offered in, which a dealt game reaches only after several turns of building.
 */
function readyToDigIn(map: GameMap, players: readonly PlayerId[]): GameState {
  const player = players[0]!;
  const opened = newGame(map, players, seededRandom(42));

  const staged = withHolding(opened, "cairn", {
    ...opened.holdings.get("cairn")!,
    owner: player,
    armies: 7,
  });
  return { ...staged, phase: "fortify", reinforcementsLeft: 0 };
}
