import { transportOver, decode, encode } from "../match/wire";
import type { Transport } from "../match/match";
import type { GameMap } from "../domain/map";
import type { Room } from "./rooms";

export type LinkState = "connecting" | "connected" | "lost";

export interface Link {
  readonly transport: Transport;
  state(): LinkState;
  onStateChange(listener: (state: LinkState) => void): void;
}

/**
 * The match, carried by the backend.
 *
 * Every action and every update goes through the room: one side appends, the
 * other reads. Two players who cannot reach each other directly is the normal
 * case on mobile networks, and a relay that has to be paid for and kept
 * running is the alternative this replaces — the game already has a backend,
 * so it carries the game.
 *
 * What it costs is a round trip to the database per tap, which a turn-based
 * game does not feel, and gameplay visible to whoever runs the project. What
 * it buys is one transport: there is no second path to test, to fall back to,
 * or to explain to a player.
 */
export function relay(room: Room, map: GameMap): Link {
  let state: LinkState = "connecting";
  const watchers: ((state: LinkState) => void)[] = [];
  const announce = (next: LinkState): void => {
    if (next === state) return;
    state = next;
    for (const watcher of watchers) watcher(state);
  };

  let deliver: ((message: ReturnType<typeof decode>) => void) | undefined;
  room.receive((message) => {
    announce("connected");
    deliver?.(decode(message, map));
  });
  room.whenTheOtherGoes(() => announce("lost"));

  /*
   * A message that cannot be sent has not been sent, and the player is going
   * to be waiting on what it would have done. Saying the connection is lost is
   * the truth a seat can act on; there is nothing else to fall back to.
   */
  const transport: Transport = transportOver({
    send: (message) => {
      void room.send(encode(message)).catch(() => announce("lost"));
    },
    receive: (handler) => {
      deliver = handler;
    },
  });

  return {
    transport,
    state: () => state,
    onStateChange: (listener) => void watchers.push(listener),
  };
}
