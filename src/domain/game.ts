import type { GameMap, TerritoryId } from "./map";

export type PlayerId = string;

/** One phase of a player's turn, in the order they are played. */
export type Phase = "deploy" | "attack" | "fortify";

export const PHASE_ORDER: readonly Phase[] = ["deploy", "attack", "fortify"];

/**
 * A territory dug in. A line is declared long before it protects: the count is
 * how many of the holder's own turns must still end before it holds. The line
 * is secret until an attack runs into it, so the wait is a bet placed early
 * rather than a warning given: see docs/rules.md.
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

/*
 * Armies a territory must keep standing for a line to be declared or to hold.
 * PROVISIONAL: five is high enough that a line is a real commitment of force
 * and low enough to reach early, which decides whether anyone ever builds a
 * second one. docs/rules.md has called this open since lines were added.
 */
export const LINE_MINIMUM_GARRISON = 5;

/*
 * Turns of the declaring player's own that must end before a line protects.
 * PROVISIONAL: two means a line protects from the end of the declaring
 * player's next turn, so entrenching is a bet placed a round early rather than
 * a reaction to an attack already coming. One turn makes it a reaction; three
 * makes it a fortress nobody has time to build.
 */
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
  if (!state.holdings.has(territory)) {
    // Every territory is held from the deal onwards, so a name the board does
    // not know is a mistake in the caller. Setting it anyway would invent a
    // territory that is on no map.
    throw new Error(`no territory "${territory}" on this board`);
  }
  const holdings = new Map(state.holdings);
  holdings.set(territory, manned(holding));
  return { ...state, holdings };
}

function manned(holding: Holding): Holding {
  return holding.armies < LINE_MINIMUM_GARRISON && holding.line !== null
    ? { ...holding, line: null }
    : holding;
}
