import { describe, expect, it } from "vitest";
import { validateMap } from "./map";
import { withinBomberReach, BOMBER_REACH } from "./reach";
import { provingMap } from "../maps/proving";
import { attack, fortify } from "./turn";
import { fixedDice } from "./dice";
import { stateWhere } from "./testGames";
import type { GameMap } from "./map";

/** A chain of territories, each bordering the next and nothing else. */
function chain(length: number, seaLinks: Readonly<Record<string, string[]>> = {}): GameMap {
  return validateMap({
    id: "chain",
    name: "Chain",
    width: length * 10,
    height: 10,
    continents: [{ id: "only", name: "Only", bonus: 0 }],
    territories: Array.from({ length }, (_, index) => ({
      id: `t${index}`,
      name: `T${index}`,
      continent: "only",
      neighbours: [index - 1, index + 1]
        .filter((n) => n >= 0 && n < length)
        .map((n) => `t${n}`),
      seaLinks: seaLinks[`t${index}`] ?? [],
      shape: [
        { x: index * 10, y: 0 },
        { x: index * 10 + 10, y: 0 },
        { x: index * 10 + 10, y: 10 },
      ],
    })),
  });
}

describe("how far a bomber reaches", () => {
  it("reaches a territory it borders", () => {
    expect(withinBomberReach(chain(5), "t0", "t1")).toBe(true);
  });

  it("reaches over a territory in between", () => {
    expect(BOMBER_REACH).toBe(2);
    expect(withinBomberReach(chain(5), "t0", "t2")).toBe(true);
  });

  it("does not reach three borders away", () => {
    expect(withinBomberReach(chain(5), "t0", "t3")).toBe(false);
  });

  it("reaches across water however far the ground route runs", () => {
    const withWater = chain(6, { t0: ["t5"], t5: ["t0"] });
    expect(withinBomberReach(withWater, "t0", "t5")).toBe(true);
  });

  it("does not treat a sea link as a stepping stone to somewhere else", () => {
    const withWater = chain(8, { t0: ["t5"], t5: ["t0"] });
    expect(withinBomberReach(withWater, "t0", "t7")).toBe(false);
  });

  it("does not reach itself", () => {
    expect(withinBomberReach(chain(5), "t0", "t0")).toBe(false);
  });

  it("reaches everything on the proving map, which is small", () => {
    for (const from of provingMap.territories) {
      for (const to of provingMap.territories) {
        if (from.id === to.id) continue;
        expect(withinBomberReach(provingMap, from.id, to.id)).toBe(true);
      }
    }
  });
});

describe("a map with water on it", () => {
  it("refuses a sea link that only one side knows about", () => {
    expect(() => chain(4, { t0: ["t3"] })).toThrow(/symmetric/i);
  });

  it("refuses a sea link to a territory that is not on the map", () => {
    expect(() => chain(4, { t0: ["atlantis"], atlantis: [] })).toThrow(/atlantis/);
  });

  it("refuses water where a land border already runs", () => {
    expect(() => chain(4, { t0: ["t1"], t1: ["t0"] })).toThrow(/border/i);
  });

  it("refuses a territory linked to itself by sea", () => {
    expect(() => chain(4, { t0: ["t0"] })).toThrow(/itself/i);
  });
});

describe("armies cannot cross water", () => {
  const acrossTheSea = { alfa: "red", bravo: "red", charlie: "red", delta: "blue", echo: "blue" } as const;

  it("refuses a ground attack along a sea link", () => {
    const state = stateWhere(acrossTheSea, {
      phase: "attack",
      armies: { alfa: 5, echo: 2 },
    });
    expect(() => attack(state, "alfa", "echo", fixedDice([6, 6, 6]))).toThrow(/border/i);
  });

  it("refuses a fortify along a sea link", () => {
    const ownBothShores = { alfa: "red", bravo: "blue", charlie: "blue", delta: "blue", echo: "red" } as const;
    const state = stateWhere(ownBothShores, { phase: "fortify", armies: { alfa: 5 } });
    expect(() => fortify(state, "alfa", "echo", 2)).toThrow(/path|connected/i);
  });

  it("but a bomber crosses it", () => {
    expect(provingMap.territories.find((t) => t.id === "alfa")?.seaLinks).toEqual(["echo"]);
    expect(withinBomberReach(provingMap, "alfa", "echo")).toBe(true);
  });
});
