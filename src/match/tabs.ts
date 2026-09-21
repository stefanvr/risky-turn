import type { Action, Transport, Update } from "./match";
import type { PlayerId } from "../domain/game";

/**
 * A transport between tabs of one browser.
 *
 * It is not a network and proves nothing about reaching another machine. What
 * it does prove is that the seam survives a real boundary: two page contexts
 * that share no memory, with every message serialised on the way across. The
 * loopback transport cannot show that, because it lives inside one page.
 *
 * The tab holding the host answers actions directly; every other tab posts
 * them. A seat mounted in this tab is delivered to in place, and one that is
 * not is posted to.
 */
type Carried =
  | { readonly to: "host"; readonly player: PlayerId; readonly action: Action }
  | { readonly to: "seat"; readonly player: PlayerId; readonly update: Update };

export function tabTransport(room: string): Transport {
  const channel = new BroadcastChannel(`risky-turn:${room}`);
  let handler: ((player: PlayerId, action: Action) => void) | undefined;
  const listeners = new Map<PlayerId, ((update: Update) => void)[]>();

  const seatsHere = (player: PlayerId): ((update: Update) => void)[] =>
    listeners.get(player) ?? [];

  channel.onmessage = (event: MessageEvent<Carried>) => {
    const message = event.data;
    if (message.to === "host") handler?.(message.player, message.action);
    else for (const listener of seatsHere(message.player)) listener(message.update);
  };

  return {
    submit(player, action) {
      if (handler !== undefined) handler(player, action);
      else channel.postMessage({ to: "host", player, action } satisfies Carried);
    },
    onAction(next) {
      handler = next;
    },
    deliver(player, update) {
      const here = seatsHere(player);
      if (here.length > 0) for (const listener of here) listener(update);
      else channel.postMessage({ to: "seat", player, update } satisfies Carried);
    },
    onUpdate(player, listener) {
      listeners.set(player, [...seatsHere(player), listener]);
    },
  };
}
