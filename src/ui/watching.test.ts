import { beforeEach, describe, expect, it } from "vitest";
import { mountSeat } from "./seat";
import { openMatch } from "../match/match";
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

function watchingSeat(): void {
  const match = openMatch({
    state: stateWhere(board, { phase: "attack", armies: { alfa: 5, bravo: 1 } }),
    dice: fixedDice([6, 6, 6]),
    transport: loopback(),
  });
  mountSeat(host, match.seat("Blue"));
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

  it("offers no control, because there is nothing to press", () => {
    watchingSeat();
    expect(host.querySelector<HTMLElement>('[data-role="end-phase"]')?.hidden).toBe(true);
  });

  it("says whose turn it is", () => {
    watchingSeat();
    expect(host.querySelector('[data-role="turn"]')?.textContent).toContain("Red");
  });
});
