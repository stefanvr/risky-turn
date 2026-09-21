import {
  BOMBER_COST,
  BOMBS_KILL_FROM,
  lineIsHolding,
  LINE_MINIMUM_GARRISON,
  TURNS_TO_HARDEN,
} from "../domain/game";
import { BOMBER_REACH, withinBomberReach } from "../domain/reach";
import { REINFORCEMENT_FLOOR, TERRITORIES_PER_ARMY } from "../domain/reinforcements";
import { bordersEachOther, canDigIn } from "../domain/turn";
import type { GameState, Holding, PlayerId } from "../domain/game";
import type { TerritoryId } from "../domain/map";

export interface TerritoryPresentation {
  readonly id: TerritoryId;
  readonly name: string;
  readonly owner: PlayerId;
  /** Position in turn order, from one, so a player keeps one colour all game. */
  readonly playerNumber: number;
  readonly armies: number;
  readonly bombers: number;
  readonly selected: boolean;
  /** "building" while a declared line is still arming, "holding" once it protects. */
  readonly line: LineShown;
  /** Which force the next tap would strike with, while this cell is chosen. */
  readonly poised: Poised;
  /**
   * Whether the poised force could strike here, and `null` while nothing is
   * poised. Neither a bomber's range nor which neighbours may be attacked is
   * drawn on the map, so both are answered on the board itself at the moment
   * the question is asked.
   */
  readonly reach: Reach;
}

export type Reach = "in" | "out" | null;

export type Poised = "armies" | "bombers" | null;

export type LineShown = "none" | "building" | "holding";

export interface RaidShown {
  readonly attacker: PlayerId;
  readonly target: string;
  readonly dice: readonly number[];
  readonly kills: number;
}

/** What a bombing run came to, in words. The dice are drawn by the view. */
export function describeRaid(raid: RaidShown): string {
  if (raid.kills === 0) return `${raid.target} is untouched`;
  return `${armies(raid.kills)} destroyed in ${raid.target}`;
}

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

/**
 * Whose turn it is and what that turn still owes. It is on screen from the
 * first tap to the last, so nothing else has to keep saying it.
 */
export interface TurnShown {
  readonly player: PlayerId;
  /** Position in turn order, from one: the colour the player wears. */
  readonly playerNumber: number;
  /** The phase, and what it is still waiting for: "Deploy · 3 to place". */
  readonly doing: string;
}

/** A control that belongs to one phase, named after what pressing it does. */
export interface ControlShown {
  readonly label: string;
}

export interface GamePresentation {
  readonly territories: readonly TerritoryPresentation[];
  readonly turn: TurnShown;
  readonly status: string;
  /** The fortify phase's own control, or null where the move is not available. */
  readonly digIn: ControlShown | null;
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
  armed?: TerritoryId | null,
): GamePresentation {
  const territories = state.map.territories.map((territory) => {
    const holding = state.holdings.get(territory.id)!;
    return {
      id: territory.id,
      name: territory.name,
      owner: holding.owner,
      playerNumber: playerNumberOf(state, holding.owner),
      armies: holding.armies,
      bombers: holding.bombers,
      // A cell with its squadron armed is still the cell that is acting, so
      // it keeps the outline even though it is no longer the tap-selection.
      selected: territory.id === selected || territory.id === (armed ?? null),
      line: lineShown(holding, state.currentPlayer),
      poised: poisedOn(state, territory.id, selected, armed ?? null),
      reach: reachOf(state, territory.id, selected, armed ?? null),
    };
  });

  return {
    territories,
    turn: turnOf(state),
    status: note ?? selectionPrompt(state, selected) ?? statusOf(state),
    digIn:
      selected !== null && canDigIn(state, selected)
        ? { label: `Dig in at ${nameOf(state, selected)}` }
        : null,
    canEndPhase: state.winner === null && state.reinforcementsLeft === 0,
    endPhaseLabel: state.phase === "fortify" ? "End turn" : "End phase",
  };
}

/**
 * Whose turn it is, for the indicator that carries it. It is read on its own
 * during a handover, when there is no board to present.
 */
export function turnOf(state: GameState): TurnShown {
  return {
    player: state.currentPlayer,
    playerNumber: playerNumberOf(state, state.currentPlayer),
    doing: doingNow(state),
  };
}

function doingNow(state: GameState): string {
  if (state.winner !== null) return "Game over";

  switch (state.phase) {
    case "deploy":
      return state.reinforcementsLeft > 0
        ? `Deploy · ${state.reinforcementsLeft} to place`
        : "Deploy · all placed";
    case "attack":
      return "Attack";
    case "fortify":
      return state.hasFortified ? "Fortify · spent" : "Fortify";
  }
}

export interface LegendEntry {
  readonly term: string;
  readonly detail: string;
  /**
   * The continent this entry is about, numbered as the map lists them, so the
   * sheet can show the very colour that continent's coast wears on the board.
   * Absent on an entry that is about no particular ground.
   */
  readonly coast?: number;
}

export interface LegendSection {
  readonly title: string;
  readonly entries: readonly LegendEntry[];
}

/**
 * The numbers a player has to know and cannot read off the board. Every one of
 * them is taken from the rule that owns it, so the sheet cannot drift away
 * from the game it describes; the continents are read from the board in play.
 */
export function legendOf(state: GameState): readonly LegendSection[] {
  return [
    {
      title: "What a turn earns",
      entries: [
        {
          term: "Territories held",
          detail:
            `1 army for every ${TERRITORIES_PER_ARMY} territories you hold, ` +
            `and never fewer than ${REINFORCEMENT_FLOOR}.`,
        },
      ],
    },
    {
      title: "Continents, held outright",
      entries: state.map.continents.map((continent, index) => ({
        term: continent.name,
        detail: `+${continent.bonus} armies a turn`,
        coast: index + 1,
      })),
    },
    {
      title: "What things cost",
      entries: [
        { term: "Army", detail: "1 reinforcement, placed on ground you already hold." },
        {
          term: "Bomber",
          detail:
            `${BOMBER_COST} reinforcements. It strikes up to ${BOMBER_REACH} borders ` +
            `away or across one sea link, rolls one die per bomber and destroys an ` +
            `army on a ${BOMBS_KILL_FROM} or better. It takes no ground and never ` +
            `kills the last defender.`,
        },
        {
          term: "Defensive line",
          detail:
            `Nothing, but the territory must keep ${LINE_MINIMUM_GARRISON} armies ` +
            `standing, and the line only protects once ${TURNS_TO_HARDEN} of your ` +
            `own turns have ended.`,
        },
      ],
    },
  ];
}

/**
 * A player's position in turn order, from one, and zero for a player who is
 * not in this game. It is what every colour in the interface is chosen by, so
 * one player wears one colour wherever they appear.
 */
export function playerNumberOf(state: GameState, player: PlayerId): number {
  return state.players.indexOf(player) + 1;
}

/**
 * With a territory chosen, the status stops describing the phase and starts
 * naming the moves actually available from here.
 */
function selectionPrompt(state: GameState, selected: TerritoryId | null): string | undefined {
  if (selected === null || state.winner !== null) return undefined;

  const holding = state.holdings.get(selected);
  if (holding === undefined) return undefined;
  const name = nameOf(state, selected);

  if (state.phase === "attack") {
    return holding.bombers > 0 && !holding.bombersFlown
      ? `${name} selected. Tap a bordering enemy to attack, or tap it again to send its bombers.`
      : `${name} selected. Tap a bordering enemy to attack.`;
  }
  if (state.phase !== "fortify") return undefined;

  return `${name} selected. Tap where to move its armies.`;
}

/** What a territory is called, for a line a player reads. */
function nameOf(state: GameState, territory: TerritoryId): string {
  return state.map.territories.find((candidate) => candidate.id === territory)?.name ?? territory;
}

/**
 * Lines are secret. The phone shows the works of whoever's turn it is, and an
 * opponent's only once an attack has run into them — after which they stay on
 * the board for good.
 */
/**
 * With two ways to strike from one cell, a chosen cell has to say which it
 * would use. Only the attack phase has that ambiguity, so only it accents.
 */
function poisedOn(
  state: GameState,
  territory: TerritoryId,
  selected: TerritoryId | null,
  armed: TerritoryId | null,
): Poised {
  if (state.phase !== "attack" || state.winner !== null) return null;
  if (territory === armed) return "bombers";
  return territory === selected ? "armies" : null;
}

/**
 * Whether the poised force could strike this cell now — the same question for
 * a squadron and for an army, and the same answer a tap would get.
 *
 * The cell that is acting is never veiled: it is not a target, it is the cell
 * being asked about, and veiling it would hide the force in question.
 */
function reachOf(
  state: GameState,
  territory: TerritoryId,
  selected: TerritoryId | null,
  armed: TerritoryId | null,
): Reach {
  const acting = armed ?? (state.phase === "attack" ? selected : null);
  if (acting === null || state.winner !== null) return null;
  if (territory === acting) return "in";

  // Neither force may strike its own side, so ground held by the player is
  // never a target, however close it lies.
  const target = state.holdings.get(territory);
  if (target === undefined || target.owner === state.currentPlayer) return "out";

  const open = armed !== null
    ? withinBomberReach(state.map, acting, territory)
    : bordersEachOther(state, acting, territory);
  return open ? "in" : "out";
}

function lineShown(holding: Holding, viewer: PlayerId): LineShown {
  if (holding.line === null) return "none";
  if (holding.owner !== viewer && !holding.line.revealed) return "none";
  return lineIsHolding(holding) ? "holding" : "building";
}

function statusOf(state: GameState): string {
  if (state.winner !== null) return `${state.winner} holds the map and has won.`;

  // Whose turn it is is on screen permanently, so the line that has to carry
  // what just happened spends none of its room saying it again.
  switch (state.phase) {
    case "deploy":
      return state.reinforcementsLeft > 0
        ? `Place ${armies(state.reinforcementsLeft)}.`
        : "All armies placed. End the phase.";
    case "attack":
      return "Attack, or end the phase.";
    case "fortify":
      return state.hasFortified
        ? "Nothing more this turn. End the turn."
        : "Fortify once, or end the turn.";
  }
}

function armies(count: number): string {
  return count === 1 ? "1 army" : `${count} armies`;
}
