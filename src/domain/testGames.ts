import { provingMap } from "../maps/proving";
import type { GameState, Holding, Phase, PlayerId } from "./game";
import type { TerritoryId } from "./map";

export interface BoardOverrides {
  readonly players?: readonly PlayerId[];
  readonly currentPlayer?: PlayerId;
  readonly phase?: Phase;
  readonly armies?: Readonly<Record<string, number>>;
  readonly lines?: Readonly<Record<string, number>>;
  readonly reinforcementsLeft?: number;
  readonly hasFortified?: boolean;
}

/**
 * Builds a game from a plain statement of who holds what, so a test reads as
 * the board it is about. Turn order follows the order players first appear on
 * the map unless it is given.
 */
export function stateWhere(
  ownership: Readonly<Record<string, PlayerId>>,
  overrides: BoardOverrides = {},
): GameState {
  const holdings = new Map<TerritoryId, Holding>();
  for (const territory of provingMap.territories) {
    const owner = ownership[territory.id];
    if (owner === undefined) {
      throw new Error(`stateWhere: no owner given for ${territory.id}`);
    }
    const turnsUntilHolding = overrides.lines?.[territory.id];
    holdings.set(territory.id, {
      owner,
      armies: overrides.armies?.[territory.id] ?? 1,
      line: turnsUntilHolding === undefined ? null : { turnsUntilHolding },
    });
  }

  const players = overrides.players ?? [...new Set(Object.values(ownership))];
  const currentPlayer = overrides.currentPlayer ?? players[0]!;

  return {
    map: provingMap,
    players,
    holdings,
    currentPlayer,
    phase: overrides.phase ?? "deploy",
    reinforcementsLeft: overrides.reinforcementsLeft ?? 0,
    hasFortified: overrides.hasFortified ?? false,
    winner: null,
  };
}
