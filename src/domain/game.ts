import type { GameMap, TerritoryId } from "./map";

export type PlayerId = string;

/** One phase of a player's turn, in the order they are played. */
export type Phase = "deploy" | "attack" | "fortify";

export const PHASE_ORDER: readonly Phase[] = ["deploy", "attack", "fortify"];

/**
 * A territory dug in. A line is declared long before it protects: the count is
 * how many of the holder's own turns must still end before it holds, so
 * opponents can see a line being built and have a round in which to break it.
 */
export interface DefensiveLine {
  readonly turnsUntilHolding: number;
  /** Set once an attack has run into it. Known lines stay known. */
  readonly revealed: boolean;
}

export interface Holding {
  readonly owner: PlayerId;
  readonly armies: number;
  readonly line: DefensiveLine | null;
  /** Bombers standing here. Never armies: they hold nothing and defend nothing. */
  readonly bombers: number;
  /** Whether this territory's bombers have flown this turn. */
  readonly bombersFlown: boolean;
}

/*
 * PROVISIONAL: a bomber costs three reinforcements, and a bombing die kills on
 * a five or a six. Together these set how fast reach can be bought and how
 * much it does; both want a full game played before they are settled.
 */
export const BOMBER_COST = 3;
export const BOMBS_KILL_FROM = 5;

/** Armies a territory must keep standing for a line to be declared or to hold. */
export const LINE_MINIMUM_GARRISON = 5;

/** Turns of the declaring player's own that must end before a line protects. */
export const TURNS_TO_HARDEN = 2;

export function lineIsHolding(holding: Holding): boolean {
  return holding.line !== null && holding.line.turnsUntilHolding === 0;
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

/**
 * A new state with one territory's holding replaced.
 *
 * A line cannot outlive the garrison that mans it, so this is where a
 * collapse is enforced: every path that can thin a territory — losing a
 * battle, marching armies out, being conquered — goes through here, and none
 * of them has to remember the rule.
 */
export function withHolding(
  state: GameState,
  territory: TerritoryId,
  holding: Holding,
): GameState {
  const holdings = new Map(state.holdings);
  holdings.set(territory, manned(holding));
  return { ...state, holdings };
}

function manned(holding: Holding): Holding {
  return holding.armies < LINE_MINIMUM_GARRISON && holding.line !== null
    ? { ...holding, line: null }
    : holding;
}
