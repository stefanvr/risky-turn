import { describe, expect, it } from "vitest";
import { newGame } from "./setup";
import { seededRandom } from "./random";
import { provingMap } from "../maps/proving";
import { territoriesOf } from "./game";

describe("setting up a game", () => {
  it("gives every territory an owner", () => {
    const state = newGame(provingMap, ["red", "blue"], seededRandom(7));
    expect(state.holdings.size).toBe(provingMap.territories.length);
    for (const territory of provingMap.territories) {
      expect(state.players).toContain(state.holdings.get(territory.id)?.owner);
    }
  });

  it("shares the map out as evenly as it divides", () => {
    const state = newGame(provingMap, ["red", "blue"], seededRandom(7));
    const counts = state.players.map((player) => territoriesOf(state, player).length);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("leaves no territory undefended", () => {
    const state = newGame(provingMap, ["red", "blue"], seededRandom(7));
    for (const [, holding] of state.holdings) {
      expect(holding.armies).toBeGreaterThanOrEqual(1);
    }
  });

  it("gives both players the same number of armies on the board", () => {
    const state = newGame(provingMap, ["red", "blue"], seededRandom(7));
    const armies = (player: string) =>
      territoriesOf(state, player).reduce(
        (total, territory) => total + (state.holdings.get(territory)?.armies ?? 0),
        0,
      );
    expect(armies("red")).toBe(armies("blue"));
  });

  it("opens on the first player's deploy phase with armies in hand", () => {
    const state = newGame(provingMap, ["red", "blue"], seededRandom(7));
    expect(state.currentPlayer).toBe("red");
    expect(state.phase).toBe("deploy");
    expect(state.reinforcementsLeft).toBeGreaterThan(0);
    expect(state.winner).toBeNull();
  });

  it("deals the same game twice from the same seed, and a different one otherwise", () => {
    const first = newGame(provingMap, ["red", "blue"], seededRandom(7));
    const again = newGame(provingMap, ["red", "blue"], seededRandom(7));
    expect([...again.holdings]).toEqual([...first.holdings]);

    const elsewhere = newGame(provingMap, ["red", "blue"], seededRandom(99));
    expect([...elsewhere.holdings]).not.toEqual([...first.holdings]);
  });

  it("refuses a game nobody can lose", () => {
    expect(() => newGame(provingMap, ["red"], seededRandom(7))).toThrow(/two/i);
  });
});
