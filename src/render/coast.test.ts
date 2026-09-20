import { describe, expect, it } from "vitest";
import { coastsOf } from "./coast";
import { provingMap } from "../testing/provingMap";
import { worldMap } from "../maps/world";
import type { GameMap, Point } from "../domain/map";

const key = (a: Point, b: Point): string =>
  [`${a.x},${a.y}`, `${b.x},${b.y}`].toSorted().join("|");

/** Every edge of every territory in a continent, counted. */
function edgesIn(map: GameMap, continent: string): Map<string, number> {
  const counted = new Map<string, number>();
  for (const territory of map.territories) {
    if (territory.continent !== continent) continue;
    for (let i = 0; i < territory.shape.length; i += 1) {
      const edge = key(territory.shape[i]!, territory.shape[(i + 1) % territory.shape.length]!);
      counted.set(edge, (counted.get(edge) ?? 0) + 1);
    }
  }
  return counted;
}

function drawnEdges(loops: readonly (readonly Point[])[]): string[] {
  return loops.flatMap((loop) =>
    loop.map((point, i) => key(point, loop[(i + 1) % loop.length]!)),
  );
}

describe("a continent's coast", () => {
  for (const map of [provingMap, worldMap]) {
    describe(map.name, () => {
      it("is drawn for every continent, and closes", () => {
        const coasts = coastsOf(map);
        expect([...coasts.keys()].toSorted()).toEqual(
          map.continents.map((continent) => continent.id).toSorted(),
        );
        for (const [continent, loops] of coasts) {
          expect(loops.length, `${continent} has no coast`).toBeGreaterThan(0);
          for (const loop of loops) {
            expect(loop.length, `${continent} has a coast of ${loop.length} points`)
              .toBeGreaterThan(2);
          }
        }
      });

      it("runs only where the continent meets something that is not itself", () => {
        for (const continent of map.continents) {
          const counted = edgesIn(map, continent.id);
          for (const edge of drawnEdges(coastsOf(map).get(continent.id)!)) {
            expect(counted.get(edge), `${continent.id} draws an edge it does not own`)
              .toBeDefined();
            expect(
              counted.get(edge),
              `${continent.id} draws a border between two of its own territories`,
            ).toBe(1);
          }
        }
      });

      it("draws all of the outer edge, not merely some of it", () => {
        for (const continent of map.continents) {
          const outer = [...edgesIn(map, continent.id)]
            .filter(([, times]) => times === 1)
            .map(([edge]) => edge);
          const drawn = drawnEdges(coastsOf(map).get(continent.id)!);
          expect(drawn.toSorted()).toEqual(outer.toSorted());
        }
      });
    });
  }
});
