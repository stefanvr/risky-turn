import { beforeEach, describe, expect, it } from "vitest";
import { mountSeat } from "./seat";
import { openMatch } from "../match/match";
import type { Match } from "../match/match";
import { loopback } from "../match/loopback";
import { fixedDice } from "../domain/dice";
import { stateWhere } from "../domain/testGames";

const board = { alfa: "Red", bravo: "Blue", charlie: "Blue", delta: "Red", echo: "Red" } as const;

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});

function watching(): Match {
  const match = openMatch({
    state: stateWhere(board, { phase: "attack", armies: { alfa: 5, bravo: 1 } }),
    dice: fixedDice([6, 6, 6, 1, 1]),
    transport: loopback(),
  });
  mountSeat(host, match.seat("Blue"));
  return match;
}

function watchingSeat(): void {
  watching();
}

/**
 * The handover cover exists because a phone is shared. On a player's own
 * device there is nobody to hide the board from, and covering it for seven
 * turns out of eight would leave the player watching nothing at all.
 */
describe("a seat watching a turn it is not playing", () => {
  it("shows the board rather than the handover cover", () => {
    watchingSeat();
    expect(host.querySelector("svg")).not.toBeNull();
    expect(host.querySelector<HTMLElement>('[data-role="handover"]')?.hidden).toBe(true);
  });

  it("offers no control, but keeps its place on screen", () => {
    // Nothing here is pressable, and the map must still be the same size in
    // the same position when the turn comes round.
    watchingSeat();
    const end = host.querySelector<HTMLElement>('[data-role="end-phase"]');
    expect(end?.style.visibility).toBe("hidden");
    expect(end?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-role="control-slot"]')?.hidden).toBe(false);
    expect(host.querySelector<HTMLElement>('[data-role="dig-in"]')?.hidden).toBe(true);
  });

  it("says whose turn it is", () => {
    watchingSeat();
    expect(host.querySelector('[data-role="turn"]')?.textContent).toContain("Red");
  });

  it("reports the exchange it has just watched", () => {
    // Watching a board change without being told what changed it is the thing
    // the live board was chosen over a per-turn snapshot to avoid.
    const match = watching();
    match.seat("Red").send({ kind: "attack", from: "alfa", to: "bravo" });

    const battle = host.querySelector<HTMLElement>('[data-role="battle"]');
    expect(battle?.hidden).toBe(false);
    expect(battle?.textContent).toContain("Blue is driven out");
  });
});
