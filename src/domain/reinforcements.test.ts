import { describe, expect, it } from "vitest";
import { reinforcementsFor } from "./reinforcements";
import { provingMap } from "../maps/proving";
import { stateWhere } from "./testGames";
import { validateMap } from "./map";
import type { GameMap } from "./map";
import type { GameState, Holding } from "./game";

describe("how many armies a player reinforces with", () => {
  it("never gives fewer than three, however little is held", () => {
    const state = stateWhere({ alfa: "red", bravo: "blue", charlie: "blue", delta: "blue", echo: "blue" });
    expect(reinforcementsFor(state, "red")).toBe(3);
  });

  it("gives the floor plus every continent bonus when one player holds the whole map", () => {
    const state = stateWhere({ alfa: "red", bravo: "red", charlie: "red", delta: "red", echo: "red" });
    expect(reinforcementsFor(state, "red")).toBe(3 + 2 + 1);
  });

  it("gives one army per three territories held once that beats the floor", () => {
    // The proving map is too small for the per-three rule ever to govern, so
    // this asks the rule about empires large enough to reach past the floor.
    expect(reinforcementsOnALineOf(9, 9)).toBe(3);
    expect(reinforcementsOnALineOf(12, 12)).toBe(4);
    expect(reinforcementsOnALineOf(30, 20)).toBe(6);
  });

  it("adds a continent bonus only when every territory in it is held", () => {
    const partial = stateWhere({ alfa: "red", bravo: "red", charlie: "blue", delta: "red", echo: "red" });
    expect(reinforcementsFor(partial, "red")).toBe(3 + 1);

    const whole = stateWhere({ alfa: "blue", bravo: "blue", charlie: "blue", delta: "red", echo: "red" });
    expect(reinforcementsFor(whole, "red")).toBe(3 + 1);
  });

  it("gives nothing to a player who holds no territory", () => {
    const state = stateWhere({ alfa: "blue", bravo: "blue", charlie: "blue", delta: "blue", echo: "blue" });
    expect(reinforcementsFor(state, "red")).toBe(0);
  });

  it("counts every continent of the map it is given", () => {
    expect(provingMap.continents).toHaveLength(2);
  });
});

/**
 * Reinforcements for a player holding `held` of a chain of `size` territories,
 * on a map whose single continent grants no bonus, so only the territory count
 * is under test.
 */
function reinforcementsOnALineOf(size: number, held: number): number {
  const map: GameMap = validateMap({
    id: "line",
    name: "Line",
    width: size * 10,
    height: 10,
    continents: [{ id: "only", name: "Only", bonus: 0 }],
    territories: Array.from({ length: size }, (_, index) => ({
      id: `t${index}`,
      name: `T${index}`,
      continent: "only",
      neighbours: [index - 1, index + 1]
        .filter((n) => n >= 0 && n < size)
        .map((n) => `t${n}`),
      shape: [
        { x: index * 10, y: 0 },
        { x: index * 10 + 10, y: 0 },
        { x: index * 10 + 10, y: 10 },
      ],
    })),
  });

  const holdings = new Map<string, Holding>(
    map.territories.map((territory, index) => [
      territory.id,
      { owner: index < held ? "red" : "blue", armies: 1 },
    ]),
  );

  const state: GameState = {
    map,
    players: ["red", "blue"],
    holdings,
    currentPlayer: "red",
    phase: "deploy",
    reinforcementsLeft: 0,
    hasFortified: false,
    winner: null,
  };
  return reinforcementsFor(state, "red");
}
