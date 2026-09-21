import { transportOver } from "./wire";
import type { Carried } from "./wire";
import type { Transport } from "./match";

/**
 * A transport between tabs of one browser.
 *
 * It is not a network and proves nothing about reaching another machine. What
 * it does prove is that the seam survives a real boundary: two page contexts
 * that share no memory. It stays as the development route that needs no
 * account and no connection.
 */
export function tabTransport(room: string): Transport {
  const channel = new BroadcastChannel(`risky-turn:${room}`);
  return transportOver({
    send: (message) => channel.postMessage(message),
    receive: (handler) => {
      channel.onmessage = (event: MessageEvent<Carried>) => handler(event.data);
    },
  });
}
