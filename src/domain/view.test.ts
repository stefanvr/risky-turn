import { describe, expect, it } from "vitest";
import { viewFor } from "./view";
import { holdingOf, withHolding } from "./game";
import { stateWhere } from "./testGames";

const board = { alfa: "Red", bravo: "Blue", charlie: "Blue", delta: "Red", echo: "Red" } as const;

/**
 * A line is secret (docs/rules.md). On a shared phone that is enforced where
 * the board is drawn, because the viewer is always the player whose turn it
 * is. Over a wire it has to be enforced before the state is sent, or the
 * secret is handed to the opponent's own browser.
 */
describe("what a seat may know", () => {
  it("keeps the viewer's own line, hardening and all", () => {
    const state = stateWhere(board, { lines: { alfa: 2 } });
    expect(holdingOf(viewFor(state, "Red"), "alfa").line).toEqual({
      turnsUntilHolding: 2,
      revealed: false,
    });
  });

  it("carries no unrevealed line of an opponent's", () => {
    const state = stateWhere(board, { lines: { bravo: 2 } });
    expect(holdingOf(viewFor(state, "Red"), "bravo").line).toBeNull();
  });

  it("carries an opponent's line once an attack has found it", () => {
    const state = stateWhere(board, { lines: { bravo: { turns: 0, revealed: true } } });
    expect(holdingOf(viewFor(state, "Red"), "bravo").line).not.toBeNull();
  });

  it("does not say whether an opponent's squadron has flown", () => {
    const state = stateWhere(board, { bombers: { bravo: 2 } });
    const flown = withHolding(state, "bravo", {
      ...holdingOf(state, "bravo"),
      bombersFlown: true,
    });
    expect(holdingOf(viewFor(flown, "Red"), "bravo").bombersFlown).toBe(false);
    expect(holdingOf(viewFor(flown, "Blue"), "bravo").bombersFlown).toBe(true);
  });

  it("still counts what stands on the board for anyone to see", () => {
    const state = stateWhere(board, { armies: { bravo: 4 }, bombers: { bravo: 2 } });
    const seen = holdingOf(viewFor(state, "Red"), "bravo");
    expect(seen.armies).toBe(4);
    expect(seen.bombers).toBe(2);
  });
});
