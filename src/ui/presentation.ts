import { lineIsHolding, LINE_MINIMUM_GARRISON } from "../domain/game";
import type { GameState, Holding, PlayerId } from "../domain/game";
import type { TerritoryId } from "../domain/map";

export interface TerritoryPresentation {
  readonly id: TerritoryId;
  readonly name: string;
  readonly owner: PlayerId;
  /** Position in turn order, from one, so a player keeps one colour all game. */
  readonly playerNumber: number;
  readonly armies: number;
  readonly selected: boolean;
  /** "building" while a declared line is still arming, "holding" once it protects. */
  readonly line: LineShown;
}

export type LineShown = "none" | "building" | "holding";

export interface BattleShown {
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
  readonly attackerDice: readonly number[];
  readonly defenderDice: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
  readonly conquered: boolean;
}

/**
 * What an exchange cost, in words. The dice themselves are drawn by the view;
 * this is the sentence beside them.
 */
export function describeOutcome(battle: BattleShown): string {
  const toll = [
    battle.attackerLosses > 0 ? `${battle.attacker} lost ${armies(battle.attackerLosses)}` : null,
    battle.defenderLosses > 0 ? `${battle.defender} lost ${armies(battle.defenderLosses)}` : null,
  ].filter((part) => part !== null);

  if (battle.conquered) return `${battle.defender} is driven out`;
  return toll.length > 0 ? toll.join(", ") : "no losses";
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
      line: lineShown(holding, state.currentPlayer),
    };
  });

  return {
    territories,
    status: note ?? selectionPrompt(state, selected) ?? statusOf(state),
    canEndPhase: state.winner === null && state.reinforcementsLeft === 0,
    endPhaseLabel: state.phase === "fortify" ? "End turn" : "End phase",
  };
}

/**
 * With a territory chosen, the status stops describing the phase and starts
 * naming the moves actually available from here.
 */
function selectionPrompt(state: GameState, selected: TerritoryId | null): string | undefined {
  if (selected === null || state.winner !== null) return undefined;

  const holding = state.holdings.get(selected);
  if (holding === undefined) return undefined;
  const name = state.map.territories.find((t) => t.id === selected)?.name ?? selected;

  if (state.phase === "attack") return `${name} selected. Tap a bordering enemy to attack.`;
  if (state.phase !== "fortify") return undefined;

  return holding.line === null && holding.armies >= LINE_MINIMUM_GARRISON
    ? `${name} selected. Tap it again to dig in, or tap where to move its armies.`
    : `${name} selected. Tap where to move its armies.`;
}

/**
 * Lines are secret. The phone shows the works of whoever's turn it is, and an
 * opponent's only once an attack has run into them — after which they stay on
 * the board for good.
 */
function lineShown(holding: Holding, viewer: PlayerId): LineShown {
  if (holding.line === null) return "none";
  if (holding.owner !== viewer && !holding.line.revealed) return "none";
  return lineIsHolding(holding) ? "holding" : "building";
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
      return state.hasFortified
        ? `${state.currentPlayer}: nothing more this turn. End the turn.`
        : `${state.currentPlayer}: fortify once, or end the turn.`;
  }
}

function armies(count: number): string {
  return count === 1 ? "1 army" : `${count} armies`;
}
