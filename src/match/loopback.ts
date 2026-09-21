import type { Action, Transport, Update } from "./match";
import type { PlayerId } from "../domain/game";

/**
 * A transport that goes nowhere: the host and every seat share one process.
 *
 * It exists so that authority and secrecy can be checked without a network —
 * if a seat is handed something its player may not know, the loopback shows it
 * exactly as the relay would.
 */
export function loopback(): Transport {
  let handler: ((player: PlayerId, action: Action) => void) | undefined;
  const listeners = new Map<PlayerId, ((update: Update) => void)[]>();

  return {
    submit(player, action) {
      handler?.(player, action);
    },
    onAction(next) {
      handler = next;
    },
    deliver(player, update) {
      for (const listener of listeners.get(player) ?? []) listener(update);
    },
    onUpdate(player, listener) {
      listeners.set(player, [...(listeners.get(player) ?? []), listener]);
    },
  };
}
