import type { GameState, PlayerId } from "../domain/game";
import type { TerritoryId } from "../domain/map";

export interface TerritoryPresentation {
  readonly id: TerritoryId;
  readonly name: string;
  readonly owner: PlayerId;
  /** Position in turn order, from one, so a player keeps one colour all game. */
  readonly playerNumber: number;
  readonly armies: number;
  readonly selected: boolean;
}

export interface GamePresentation {
  readonly territories: readonly TerritoryPresentation[];
  readonly status: string;
  readonly canEndPhase: boolean;
  readonly endPhaseLabel: string;
}

/**
 * The single place that turns game state into what a player sees. Every rule
 * about wording, numbering and what may be pressed lives here rather than
 * being reinvented by each part of the screen.
 */
export function presentGame(
  state: GameState,
  selected: TerritoryId | null,
  note?: string,
): GamePresentation {
  const numbers = new Map(state.players.map((player, index) => [player, index + 1]));

  const territories = state.map.territories.map((territory) => {
    const holding = state.holdings.get(territory.id)!;
    return {
      id: territory.id,
      name: territory.name,
      owner: holding.owner,
      playerNumber: numbers.get(holding.owner) ?? 0,
      armies: holding.armies,
      selected: territory.id === selected,
    };
  });

  return {
    territories,
    status: note ?? statusOf(state),
    canEndPhase: state.winner === null && state.reinforcementsLeft === 0,
    endPhaseLabel: state.phase === "fortify" ? "End turn" : "End phase",
  };
}

function statusOf(state: GameState): string {
  if (state.winner !== null) return `${state.winner} holds the map and has won.`;

  switch (state.phase) {
    case "deploy":
      return state.reinforcementsLeft > 0
        ? `${state.currentPlayer}: place ${armies(state.reinforcementsLeft)}.`
        : `${state.currentPlayer}: all armies placed. End the phase.`;
    case "attack":
      return `${state.currentPlayer}: attack, or end the phase.`;
    case "fortify":
      return `${state.currentPlayer}: fortify once, or end the turn.`;
  }
}

function armies(count: number): string {
  return count === 1 ? "1 army" : `${count} armies`;
}
