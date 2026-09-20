import { describe, expect, it } from "vitest";
import { validateMap, centreOf } from "./map";
import type { GameMap } from "./map";
import { provingMap } from "../testing/provingMap";

function mapWith(patch: (draft: GameMap) => GameMap): GameMap {
  return patch(structuredClone(provingMap) as GameMap);
}

describe("map validation", () => {
  it("accepts a map whose adjacency is symmetric and complete", () => {
    expect(() => validateMap(provingMap)).not.toThrow();
  });

  it("rejects adjacency that points one way only", () => {
    const broken = mapWith((draft) => ({
      ...draft,
      territories: draft.territories.map((territory) =>
        territory.id === "alfa"
          ? { ...territory, neighbours: territory.neighbours.filter((id) => id !== "bravo") }
          : territory,
      ),
    }));
    expect(() => validateMap(broken)).toThrow(/symmetric/i);
  });

  it("rejects a neighbour that is not a territory on the map", () => {
    const broken = mapWith((draft) => ({
      ...draft,
      territories: draft.territories.map((territory, index) =>
        index === 0
          ? { ...territory, neighbours: ["atlantis"] }
          : territory,
      ),
    }));
    expect(() => validateMap(broken)).toThrow(/atlantis/);
  });

  it("rejects a territory that borders itself", () => {
    const broken = mapWith((draft) => ({
      ...draft,
      territories: draft.territories.map((territory, index) =>
        index === 0
          ? { ...territory, neighbours: [territory.id] }
          : territory,
      ),
    }));
    expect(() => validateMap(broken)).toThrow(/itself/i);
  });

  it("rejects two territories sharing one id", () => {
    const broken = mapWith((draft) => ({
      ...draft,
      territories: [...draft.territories, draft.territories[0]!],
    }));
    expect(() => validateMap(broken)).toThrow(/duplicate/i);
  });

  it("rejects a territory placed in a continent the map does not define", () => {
    const broken = mapWith((draft) => ({
      ...draft,
      territories: draft.territories.map((territory, index) =>
        index === 0 ? { ...territory, continent: "mu" } : territory,
      ),
    }));
    expect(() => validateMap(broken)).toThrow(/mu/);
  });
});

describe("where a territory's label goes", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  it("is the centre of the shape's area", () => {
    expect(centreOf(square)).toEqual({ x: 5, y: 5 });
  });

  it("does not move because one stretch of coast is drawn in more detail", () => {
    const sameSquare = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 4, y: 0 },
      { x: 6, y: 0 },
      { x: 8, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(centreOf(sameSquare)).toEqual(centreOf(square));
  });

  it("stays in the body of a territory that reaches out with a neck", () => {
    // A ten-by-ten body with a narrow neck running off to the east.
    const withNeck = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 20, y: 4 },
      { x: 20, y: 6 },
      { x: 10, y: 6 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(centreOf(withNeck).x).toBeLessThan(7);
  });
});
