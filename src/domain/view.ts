import type { GameState, Holding, PlayerId } from "./game";
import type { TerritoryId } from "./map";

/**
 * What one player may be told about the board.
 *
 * A defensive line is secret until an attack runs into it, and a squadron's
 * flight is its owner's business. On a shared device those rules can be kept
 * where the board is drawn, because the viewer is always the player whose turn
 * it is. Over a wire they cannot: a state sent whole is a state the receiving
 * browser can read whole, however carefully its own screen then draws it.
 *
 * So redaction happens here, before anything is sent, and a seat is never
 * given what its player may not know.
 */
export function viewFor(state: GameState, player: PlayerId): GameState {
  const holdings = new Map<TerritoryId, Holding>();
  for (const [territory, holding] of state.holdings) {
    holdings.set(territory, knownTo(holding, player));
  }
  return { ...state, holdings };
}

/**
 * Armies and bombers stand on the ground for anyone to count, so they survive
 * untouched. Only what the board does not show is taken away.
 */
function knownTo(holding: Holding, player: PlayerId): Holding {
  if (holding.owner === player) return holding;
  return {
    ...holding,
    line: holding.line !== null && holding.line.revealed ? holding.line : null,
    bombersFlown: false,
  };
}
