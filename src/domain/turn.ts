import {
  LINE_MINIMUM_GARRISON,
  PHASE_ORDER,
  TURNS_TO_HARDEN,
  holdingOf,
  isInTheGame,
  lineIsHolding,
  territoriesOf,
  withHolding,
} from "./game";
import { reinforcementsFor } from "./reinforcements";
import { resolveBattle } from "./combat";
import type { Battle } from "./combat";
import type { Dice } from "./dice";
import type { GameState, PlayerId, Phase } from "./game";
import type { TerritoryId } from "./map";

export class IllegalMoveError extends Error {
  override readonly name = "IllegalMoveError";
}

const illegal = (reason: string): never => {
  throw new IllegalMoveError(reason);
};

/** Places armies from this turn's reinforcements onto a held territory. */
export function deploy(
  state: GameState,
  territory: TerritoryId,
  armies: number,
): GameState {
  requirePhase(state, "deploy");
  if (armies < 1) illegal(`cannot deploy ${armies} armies`);
  if (state.reinforcementsLeft === 0) illegal("no reinforcements left to place");
  if (armies > state.reinforcementsLeft) {
    illegal(
      state.reinforcementsLeft === 1
        ? "only 1 reinforcement remains"
        : `only ${state.reinforcementsLeft} reinforcements remain`,
    );
  }
  const holding = holdingOf(state, territory);
  if (holding.owner !== state.currentPlayer) {
    illegal(`${state.currentPlayer} does not hold ${territory}`);
  }

  return {
    ...withHolding(state, territory, { ...holding, armies: holding.armies + armies }),
    reinforcementsLeft: state.reinforcementsLeft - armies,
  };
}

export interface AttackResult {
  readonly state: GameState;
  readonly battle: Battle;
  readonly conquered: boolean;
}

/**
 * One exchange of dice between two bordering territories. A single call is one
 * roll, not a fight to the finish: pressing an attack is the player's repeated
 * decision, so the rules never decide it for them.
 */
export function attack(
  state: GameState,
  from: TerritoryId,
  to: TerritoryId,
  dice: Dice,
): AttackResult {
  requirePhase(state, "attack");
  const attacker = holdingOf(state, from);
  const defender = holdingOf(state, to);

  if (attacker.owner !== state.currentPlayer) {
    illegal(`${state.currentPlayer} does not hold ${from}`);
  }
  if (defender.owner === state.currentPlayer) {
    illegal(`${to} is already the player's own territory`);
  }
  if (!bordersEachOther(state, from, to)) {
    illegal(`${from} does not border ${to}`);
  }
  if (attacker.armies < 2) {
    illegal(`${from} needs at least two armies to attack from`);
  }

  const battle = resolveBattle(
    {
      attacking: attacker.armies,
      defending: defender.armies,
      dugIn: lineIsHolding(defender),
    },
    dice,
  );

  const survivingAttackers = attacker.armies - battle.attackerLosses;
  const survivingDefenders = defender.armies - battle.defenderLosses;
  const conquered = survivingDefenders === 0;

  // A line holds ground; it does not stage attacks. Sortieing breaks it.
  let next = withHolding(state, from, {
    ...attacker,
    armies: survivingAttackers,
    line: null,
  });
  if (conquered) {
    /*
     * PROVISIONAL: on taking a territory the attacker advances with everything
     * but one army. The alternative is asking how many to move, which is a
     * second decision and a second dialog on a phone.
     */
    next = withHolding(next, from, { owner: attacker.owner, armies: 1, line: null });
    // Ground taken is ground without a line: the works were manned by the
    // player who lost it.
    next = withHolding(next, to, {
      owner: attacker.owner,
      armies: survivingAttackers - 1,
      line: null,
    });
  } else {
    // An attack that runs into works learns they are there.
    next = withHolding(next, to, {
      ...defender,
      armies: survivingDefenders,
      line: defender.line === null ? null : { ...defender.line, revealed: true },
    });
  }

  return { state: declareWinnerIfAny(next), battle, conquered };
}

/**
 * Declares a defensive line: the turn's fortify spent on digging in rather
 * than manoeuvring. It protects nothing yet — see TURNS_TO_HARDEN.
 */
export function digIn(state: GameState, territory: TerritoryId): GameState {
  requirePhase(state, "fortify");
  if (state.hasFortified) illegal("a turn allows only one fortify");

  const holding = holdingOf(state, territory);
  if (holding.owner !== state.currentPlayer) {
    illegal(`${state.currentPlayer} does not hold ${territory}`);
  }
  if (holding.line !== null) illegal(`${territory} already holds a line`);
  if (holding.armies < LINE_MINIMUM_GARRISON) {
    illegal(
      `${territory} needs ${LINE_MINIMUM_GARRISON} armies to dig in, and has ${holding.armies}`,
    );
  }

  return {
    ...withHolding(state, territory, {
      ...holding,
        line: { turnsUntilHolding: TURNS_TO_HARDEN, revealed: false },
    }),
    hasFortified: true,
  };
}

/** Moves armies between two of the player's own territories, once per turn. */
export function fortify(
  state: GameState,
  from: TerritoryId,
  to: TerritoryId,
  armies: number,
): GameState {
  requirePhase(state, "fortify");
  if (state.hasFortified) illegal("a turn allows only one fortify");

  const source = holdingOf(state, from);
  const target = holdingOf(state, to);
  if (source.owner !== state.currentPlayer) {
    illegal(`${state.currentPlayer} does not hold ${from}`);
  }
  if (target.owner !== state.currentPlayer) {
    illegal(`${state.currentPlayer} does not hold ${to}`);
  }
  if (from === to) illegal("a fortify must move armies somewhere else");
  if (armies < 1) illegal(`cannot move ${armies} armies`);
  if (armies >= source.armies) illegal(`${from} must keep at least one army`);
  if (!reachableThroughOwnTerritory(state, from, to)) {
    illegal(`no path through the player's own territory connects ${from} to ${to}`);
  }

  let next = withHolding(state, from, { ...source, armies: source.armies - armies });
  next = withHolding(next, to, { ...target, armies: target.armies + armies });
  return { ...next, hasFortified: true };
}

/**
 * Ends the current phase, and with the last of them the turn. A turn may not
 * end with reinforcements still in hand: unplaced armies would simply vanish.
 */
export function endPhase(state: GameState): GameState {
  if (state.winner !== null) illegal("the game is over");
  if (state.phase === "deploy" && state.reinforcementsLeft > 0) {
    illegal(`${state.reinforcementsLeft} reinforcements are still in hand`);
  }

  const next = PHASE_ORDER[PHASE_ORDER.indexOf(state.phase) + 1];
  if (next) return { ...state, phase: next };

  const settled = hardenLinesOf(state, state.currentPlayer);
  return beginTurnOf(settled, nextPlayerStillInTheGame(settled));
}

/**
 * Brings the player's own lines one turn closer to holding. Only their own
 * turns count, so a line cannot be armed by opponents playing quickly.
 */
function hardenLinesOf(state: GameState, player: PlayerId): GameState {
  let next = state;
  for (const [territory, holding] of state.holdings) {
    if (holding.owner !== player) continue;
    if (holding.line === null || holding.line.turnsUntilHolding === 0) continue;
    next = withHolding(next, territory, {
      ...holding,
      line: { ...holding.line, turnsUntilHolding: holding.line.turnsUntilHolding - 1 },
    });
  }
  return next;
}

function beginTurnOf(state: GameState, player: PlayerId): GameState {
  const started: GameState = {
    ...state,
    currentPlayer: player,
    phase: "deploy",
    hasFortified: false,
    reinforcementsLeft: 0,
  };
  return { ...started, reinforcementsLeft: reinforcementsFor(started, player) };
}

function nextPlayerStillInTheGame(state: GameState): PlayerId {
  const start = state.players.indexOf(state.currentPlayer);
  for (let step = 1; step <= state.players.length; step += 1) {
    const candidate = state.players[(start + step) % state.players.length]!;
    if (isInTheGame(state, candidate)) return candidate;
  }
  return state.currentPlayer;
}

function declareWinnerIfAny(state: GameState): GameState {
  const survivors = state.players.filter((player) => isInTheGame(state, player));
  const [only] = survivors;
  return survivors.length === 1 && only !== undefined
    ? { ...state, winner: only }
    : state;
}

function requirePhase(state: GameState, phase: Phase): void {
  if (state.winner !== null) illegal("the game is over");
  if (state.phase !== phase) illegal(`this is the ${state.phase} phase, not ${phase}`);
}

function bordersEachOther(state: GameState, a: TerritoryId, b: TerritoryId): boolean {
  const territory = state.map.territories.find((candidate) => candidate.id === a);
  return territory?.neighbours.includes(b) ?? false;
}

/** Armies march overland, so a fortify needs an unbroken chain of own ground. */
function reachableThroughOwnTerritory(
  state: GameState,
  from: TerritoryId,
  to: TerritoryId,
): boolean {
  const own = new Set(territoriesOf(state, state.currentPlayer));
  const seen = new Set<TerritoryId>([from]);
  const queue: TerritoryId[] = [from];

  while (queue.length > 0) {
    const here = queue.shift()!;
    if (here === to) return true;
    const territory = state.map.territories.find((candidate) => candidate.id === here);
    for (const neighbour of territory?.neighbours ?? []) {
      if (own.has(neighbour) && !seen.has(neighbour)) {
        seen.add(neighbour);
        queue.push(neighbour);
      }
    }
  }
  return false;
}
