import type { Action, Transport, Update } from "./match";
import type { GameMap } from "../domain/map";
import type { GameState, PlayerId } from "../domain/game";

/**
 * What crosses between a host and a seat. Plain and descriptive: the game
 * sends about one message per tap, so a compact encoding would buy nothing
 * worth an encoder and a schema to keep in step (PRODUCT.md records that).
 */
export type Carried =
  | { readonly to: "host"; readonly player: PlayerId; readonly action: Action }
  | { readonly to: "seat"; readonly player: PlayerId; readonly update: Update };

/** Something that carries messages: another tab, or a peer connection. */
export interface Wire {
  send(message: Carried): void;
  receive(handler: (message: Carried) => void): void;
}

/**
 * The board is one fixed world that both sides already hold, so it is taken
 * off every message and put back on arrival. Otherwise each tap would carry
 * the whole map across.
 */
export function encode(message: Carried): string {
  const stripped =
    message.to === "seat"
      ? { ...message, update: { ...message.update, view: withoutMap(message.update.view) } }
      : message;
  return JSON.stringify(stripped, (_key, value) =>
    value instanceof Map ? { holdings: [...value] } : value,
  );
}

export function decode(text: string, map: GameMap): Carried {
  const message = JSON.parse(text, (_key, value) =>
    value !== null && typeof value === "object" && Array.isArray(value.holdings)
      ? new Map(value.holdings)
      : value,
  ) as Carried;

  return message.to === "seat"
    ? { ...message, update: { ...message.update, view: { ...message.update.view, map } } }
    : message;
}

function withoutMap(view: GameState): Omit<GameState, "map"> {
  const { map: _dropped, ...rest } = view;
  return rest;
}

/**
 * One transport, whatever carries it.
 *
 * The side holding the host answers actions directly; every other side sends
 * them. A seat mounted on this side is delivered to in place, and one that is
 * not is sent to.
 */
export function transportOver(wire: Wire): Transport {
  let handler: ((player: PlayerId, action: Action) => void) | undefined;
  const listeners = new Map<PlayerId, ((update: Update) => void)[]>();
  const seatsHere = (player: PlayerId): ((update: Update) => void)[] => listeners.get(player) ?? [];

  wire.receive((message) => {
    if (message.to === "host") handler?.(message.player, message.action);
    else for (const listener of seatsHere(message.player)) listener(message.update);
  });

  return {
    submit(player, action) {
      if (handler !== undefined) handler(player, action);
      else wire.send({ to: "host", player, action });
    },
    onAction(next) {
      handler = next;
    },
    deliver(player, update) {
      const here = seatsHere(player);
      if (here.length > 0) for (const listener of here) listener(update);
      else wire.send({ to: "seat", player, update });
    },
    onUpdate(player, listener) {
      listeners.set(player, [...seatsHere(player), listener]);
    },
  };
}
