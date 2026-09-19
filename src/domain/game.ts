import type { GameMap, TerritoryId } from "./map";

export type PlayerId = string;

/** One phase of a player's turn, in the order they are played. */
export type Phase = "deploy" | "attack" | "fortify";

export const PHASE_ORDER: readonly Phase[] = ["deploy", "attack", "fortify"];

export interface Holding {
  readonly owner: PlayerId;
  readonly armies: number;
}

/**
 * The whole of a game, as plain data. Every rule below is a function from one
 * of these to the next, so a game can be replayed, inspected, or handed to a
 * renderer without the rules knowing a renderer exists.
 */
export interface GameState {
  readonly map: GameMap;
  /** Turn order. A player is skipped once they hold nothing. */
  readonly players: readonly PlayerId[];
  readonly holdings: ReadonlyMap<TerritoryId, Holding>;
  readonly currentPlayer: PlayerId;
  readonly phase: Phase;
  /** Armies still in hand this deploy phase. */
  readonly reinforcementsLeft: number;
  /** A turn allows one fortify, so it has to be remembered. */
  readonly hasFortified: boolean;
  readonly winner: PlayerId | null;
}

export function holdingOf(state: GameState, territory: TerritoryId): Holding {
  const holding = state.holdings.get(territory);
  if (!holding) throw new Error(`no such territory: ${territory}`);
  return holding;
}

export function territoriesOf(state: GameState, player: PlayerId): TerritoryId[] {
  return [...state.holdings]
    .filter(([, holding]) => holding.owner === player)
    .map(([territory]) => territory);
}

export function isInTheGame(state: GameState, player: PlayerId): boolean {
  return territoriesOf(state, player).length > 0;
}

/** A new state with one territory's holding replaced. */
export function withHolding(
  state: GameState,
  territory: TerritoryId,
  holding: Holding,
): GameState {
  const holdings = new Map(state.holdings);
  holdings.set(territory, holding);
  return { ...state, holdings };
}
