import { describe, expect, it } from "vitest";
import { openMatch } from "./match";
import { loopback } from "./loopback";
import { fixedDice } from "../domain/dice";
import { holdingOf } from "../domain/game";
import { stateWhere } from "../domain/testGames";

const board = { alfa: "Red", bravo: "Blue", charlie: "Blue", delta: "Red", echo: "Red" } as const;

/**
 * The host owns the game; a seat owns a screen. No network is involved here:
 * the loopback transport stands in for a DataChannel so that authority and
 * secrecy can be proved before either is carried over one.
 */
describe("two seats on one match", () => {
  it("shows a watching seat what the acting seat just did", () => {
    const match = openMatch({
      state: stateWhere(board, { phase: "attack", armies: { alfa: 5, bravo: 1 } }),
      dice: fixedDice([6, 6, 6, 1, 1]),
      transport: loopback(),
    });
    const red = match.seat("Red");
    const blue = match.seat("Blue");

    red.send({ kind: "attack", from: "alfa", to: "bravo" });

    expect(holdingOf(blue.view(), "bravo").owner).toBe("Red");
  });

  it("sends a watching seat nothing of an opponent's unrevealed line", () => {
    const match = openMatch({
      state: stateWhere(board, { phase: "attack", armies: { alfa: 6 }, lines: { alfa: 2 } }),
      dice: fixedDice([6, 6, 6]),
      transport: loopback(),
    });

    expect(holdingOf(match.seat("Blue").view(), "alfa").line).toBeNull();
  });

  it("ignores an action from a seat whose turn it is not", () => {
    const match = openMatch({
      state: stateWhere(board, { phase: "attack", armies: { alfa: 5, bravo: 1 } }),
      dice: fixedDice([6, 6, 6, 1, 1]),
      transport: loopback(),
    });
    const blue = match.seat("Blue");

    blue.send({ kind: "attack", from: "bravo", to: "alfa" });

    expect(holdingOf(blue.view(), "alfa").owner).toBe("Red");
  });
});
