import { attack, bomb, buildBomber, deploy, digIn, endPhase, fortify, IllegalMoveError } from "../domain/turn";
import { viewFor } from "../domain/view";
import type { Battle } from "../domain/combat";
import type { Dice } from "../domain/dice";
import type { GameState, PlayerId } from "../domain/game";
import type { TerritoryId } from "../domain/map";

/** What a seat asks the host to do. One per move the rules offer. */
export type Action =
  | { readonly kind: "deploy"; readonly territory: TerritoryId; readonly armies: number }
  | { readonly kind: "buildBomber"; readonly territory: TerritoryId }
  | { readonly kind: "bomb"; readonly from: TerritoryId; readonly to: TerritoryId }
  | { readonly kind: "attack"; readonly from: TerritoryId; readonly to: TerritoryId }
  | { readonly kind: "digIn"; readonly territory: TerritoryId }
  | { readonly kind: "fortify"; readonly from: TerritoryId; readonly to: TerritoryId; readonly armies: number }
  | { readonly kind: "endPhase" };

/**
 * What just happened, as the rules produced it. Every seat is told, because a
 * battle is fought in the open: it is the board moving, not a secret.
 */
export type Outcome =
  | {
      readonly kind: "battle";
      readonly from: TerritoryId;
      readonly to: TerritoryId;
      readonly attacker: PlayerId;
      readonly defender: PlayerId;
      readonly battle: Battle;
      readonly conquered: boolean;
    }
  | {
      readonly kind: "raid";
      readonly from: TerritoryId;
      readonly to: TerritoryId;
      readonly attacker: PlayerId;
      readonly dice: readonly number[];
      readonly kills: number;
    };

export interface Update {
  /** The board as this seat's player may know it. */
  readonly view: GameState;
  readonly outcome?: Outcome | undefined;
  /** Why the host would not do what this seat asked. Sent to that seat alone. */
  readonly refused?: string | undefined;
}

/**
 * Carries actions to the host and updates back. A loopback implementation runs
 * a match in one process; a DataChannel implementation runs one between
 * browsers. Nothing above this interface knows which it has.
 */
export interface Transport {
  submit(player: PlayerId, action: Action): void;
  onAction(handler: (player: PlayerId, action: Action) => void): void;
  deliver(player: PlayerId, update: Update): void;
  onUpdate(player: PlayerId, listener: (update: Update) => void): void;
}

/** One player's screen onto the match. It asks; it never decides. */
export interface Seat {
  readonly player: PlayerId;
  view(): GameState;
  outcome(): Outcome | undefined;
  refusal(): string | undefined;
  send(action: Action): void;
  onUpdate(listener: (update: Update) => void): void;
}

export interface Match {
  seat(player: PlayerId): Seat;
}

export interface MatchOptions {
  readonly state: GameState;
  readonly dice: Dice;
  readonly transport: Transport;
}

/**
 * The host. It owns the game and is the only thing that applies a move: an
 * action from a seat whose turn it is not changes nothing, and neither does
 * one the rules refuse.
 */
export function openMatch({ state, dice, transport }: MatchOptions): Match {
  let game = state;
  const seats = new Map<PlayerId, Seat>();

  const tell = (outcome?: Outcome, refused?: { player: PlayerId; why: string }): void => {
    for (const player of seats.keys()) {
      transport.deliver(player, {
        view: viewFor(game, player),
        outcome,
        refused: refused?.player === player ? refused.why : undefined,
      });
    }
  };

  transport.onAction((player, action) => {
    if (player !== game.currentPlayer) return;
    try {
      const applied = apply(game, action, dice);
      game = applied.state;
      tell(applied.outcome);
    } catch (error) {
      if (!(error instanceof IllegalMoveError)) throw error;
      tell(undefined, { player, why: error.message });
    }
  });

  return {
    seat(player) {
      const existing = seats.get(player);
      if (existing) return existing;

      let latest: Update = { view: viewFor(game, player) };
      const listeners: ((update: Update) => void)[] = [];
      transport.onUpdate(player, (update) => {
        latest = update;
        for (const listener of listeners) listener(update);
      });

      const seat: Seat = {
        player,
        view: () => latest.view,
        outcome: () => latest.outcome,
        refusal: () => latest.refused,
        send: (action) => transport.submit(player, action),
        onUpdate: (listener) => {
          listeners.push(listener);
        },
      };
      seats.set(player, seat);
      return seat;
    },
  };
}

interface Applied {
  readonly state: GameState;
  readonly outcome?: Outcome | undefined;
}

function apply(state: GameState, action: Action, dice: Dice): Applied {
  switch (action.kind) {
    case "deploy":
      return { state: deploy(state, action.territory, action.armies) };
    case "buildBomber":
      return { state: buildBomber(state, action.territory) };
    case "digIn":
      return { state: digIn(state, action.territory) };
    case "fortify":
      return { state: fortify(state, action.from, action.to, action.armies) };
    case "endPhase":
      return { state: endPhase(state) };
    case "bomb": {
      const attacker = state.currentPlayer;
      const raid = bomb(state, action.from, action.to, dice);
      return {
        state: raid.state,
        outcome: {
          kind: "raid",
          from: action.from,
          to: action.to,
          attacker,
          dice: raid.dice,
          kills: raid.kills,
        },
      };
    }
    case "attack": {
      const attacker = state.currentPlayer;
      const defender = state.holdings.get(action.to)?.owner ?? attacker;
      const fought = attack(state, action.from, action.to, dice);
      return {
        state: fought.state,
        outcome: {
          kind: "battle",
          from: action.from,
          to: action.to,
          attacker,
          defender,
          battle: fought.battle,
          conquered: fought.conquered,
        },
      };
    }
  }
}

/**
 * One screen passed from hand to hand: it always speaks as the player whose
 * turn it is, and is sent that player's view. A shared device needs no other
 * arrangement, because the person holding it is the person playing.
 */
export function sharedSeat(match: Match, players: readonly PlayerId[]): Seat {
  const seats = new Map(players.map((player) => [player, match.seat(player)]));
  const listeners: ((update: Update) => void)[] = [];

  const first = players[0];
  if (first === undefined) throw new Error("a match needs at least one player");
  let latest: Update = { view: seats.get(first)!.view() };
  let current: PlayerId = latest.view.currentPlayer;

  for (const [player, seat] of seats) {
    seat.onUpdate((update) => {
      // Every seat is told what happened. This screen takes the copy addressed
      // to whoever is now playing, and ignores the rest.
      if (update.view.currentPlayer !== player) return;
      current = player;
      latest = update;
      for (const listener of listeners) listener(update);
    });
  }

  return {
    get player() {
      return current;
    },
    view: () => latest.view,
    outcome: () => latest.outcome,
    refusal: () => latest.refused,
    send: (action) => seats.get(current)!.send(action),
    onUpdate: (listener) => {
      listeners.push(listener);
    },
  };
}
