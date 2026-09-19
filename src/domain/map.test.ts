import { describe, expect, it } from "vitest";
import { validateMap } from "./map";
import type { GameMap } from "./map";
import { provingMap } from "../maps/proving";

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
