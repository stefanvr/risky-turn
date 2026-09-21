import { mountSeat } from "./seat";
import { openMatch, sharedSeat } from "../match/match";
import { loopback } from "../match/loopback";
import type { MountedSeat } from "./seat";
import type { Dice } from "../domain/dice";
import type { GameState } from "../domain/game";

export type MountedGame = MountedSeat;

/**
 * The shared-device screen.
 *
 * It is a match like any other: one authoritative host, and one seat that
 * happens to be passed from hand to hand rather than carried by a player of
 * its own. The rules, the redaction and the handover therefore have a single
 * implementation, and a game played on one phone cannot drift from a game
 * played across several.
 */
export function mountGame(host: Element, initial: GameState, dice: Dice): MountedGame {
  const match = openMatch({ state: initial, dice, transport: loopback() });
  return mountSeat(host, sharedSeat(match, initial.players), { handsOver: true });
}
