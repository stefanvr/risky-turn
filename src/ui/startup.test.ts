import { describe, expect, it } from "vitest";
import { chooseStartingState } from "./startup";
import { worldMap } from "../maps/world";
import { lineIsHolding } from "../domain/game";
import { fixtureNamed } from "../dev/fixtures";

const players = ["Red", "Blue"] as const;
const open = { map: worldMap, players, fixtures: fixtureNamed, now: () => 1_000 };
const shut = { ...open, fixtures: undefined };

describe("choosing the game to start", () => {
  it("deals the same game twice from the same seed", () => {
    const first = chooseStartingState("?seed=42", open);
    const again = chooseStartingState("?seed=42", open);
    expect([...again.state.holdings]).toEqual([...first.state.holdings]);
    expect(first.seed).toBe(42);
  });

  it("deals a different game from a different seed", () => {
    const first = chooseStartingState("?seed=42", open);
    const other = chooseStartingState("?seed=43", open);
    expect([...other.state.holdings]).not.toEqual([...first.state.holdings]);
  });

  it("falls back to the clock when no seed is given", () => {
    expect(chooseStartingState("", open).seed).toBe(1_000);
  });

  it("ignores a seed that is not a number rather than dealing from NaN", () => {
    expect(chooseStartingState("?seed=later", open).seed).toBe(1_000);
  });
});

describe("starting from a fixture", () => {
  it("puts a known position on the board", () => {
    const { state } = chooseStartingState("?fixture=found-line", open);
    const dug = state.holdings.get("harrow")!;
    expect(dug.owner).not.toBe(state.currentPlayer);
    expect(dug.line?.revealed).toBe(true);
    expect(lineIsHolding(dug)).toBe(true);
  });

  it("leaves every territory owned and garrisoned, as any real game is", () => {
    const { state } = chooseStartingState("?fixture=found-line", open);
    expect(state.holdings.size).toBe(worldMap.territories.length);
    for (const [, holding] of state.holdings) {
      expect(state.players).toContain(holding.owner);
      expect(holding.armies).toBeGreaterThanOrEqual(1);
    }
  });

  it("refuses a fixture it does not know", () => {
    expect(() => chooseStartingState("?fixture=nonsense", open)).toThrow(/nonsense/);
  });

  it("is unreachable when the gate is shut", () => {
    const { state } = chooseStartingState("?fixture=found-line", shut);
    expect(state.holdings.get("harrow")?.line ?? null).toBeNull();
  });

  it("still deals a normal game when the gate is shut", () => {
    const gated = chooseStartingState("?fixture=found-line&seed=42", shut);
    const plain = chooseStartingState("?seed=42", shut);
    expect([...gated.state.holdings]).toEqual([...plain.state.holdings]);
  });
});
