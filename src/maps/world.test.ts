import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { worldMap } from "./world";
import { validateMap, centreOf } from "../domain/map";
import { withinBomberReach } from "../domain/reach";
import { createMapView } from "../render/mapView";
import type { GameMap, Point, Territory, TerritoryId } from "../domain/map";

/**
 * The world is the board the game is played on, so these tests are about
 * whether it can be played rather than about whether it parses: is every
 * territory reachable, does every cell take a thumb, and does every cell hold
 * what the renderer draws in it.
 *
 * The screen measurements are taken from the SVG the renderer actually
 * produces and the sizes the stylesheet actually sets, because a map that is
 * correct as data and illegible as a picture has failed at the only thing it
 * is for.
 */

/**
 * The phone the board is drawn for: a 390px-wide screen, less the board's own
 * 0.75rem side padding, by what is left under the title, the status line and
 * the controls. `preserveAspectRatio="xMidYMid meet"` fits the map inside
 * that box, so the smaller of the two ratios is the scale.
 */
const MAP_BOX = { width: 366, height: 560 };

/** Apple's minimum touch target, and the size a cell must admit. */
const THUMB = 44;

const scale = Math.min(MAP_BOX.width / worldMap.width, MAP_BOX.height / worldMap.height);

type Polygon = readonly Point[];
interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Ray casting. Points exactly on an edge are not to be relied on. */
function encloses(polygon: Polygon, point: Point): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    const crossing = a.x + ((point.y - a.y) / (b.y - a.y)) * (b.x - a.x);
    if (point.x < crossing) inside = !inside;
  }
  return inside;
}

function boundsOf(polygon: Polygon): Box {
  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/**
 * The side of the largest axis-aligned square that fits inside the shape, in
 * map units. Sampled on a grid and solved as the classic maximal-square
 * problem, so it is a lower bound at the grid's resolution rather than an
 * exact figure — which is the safe direction for a minimum.
 */
function largestSquareIn(polygon: Polygon, step = 0.5): number {
  const bounds = boundsOf(polygon);
  const columns = Math.floor(bounds.width / step) + 1;
  const rows = Math.floor(bounds.height / step) + 1;
  let best = 0;
  let previous = new Array<number>(columns).fill(0);
  for (let row = 0; row < rows; row += 1) {
    const current = new Array<number>(columns).fill(0);
    for (let column = 0; column < columns; column += 1) {
      const point = { x: bounds.x + column * step, y: bounds.y + row * step };
      if (!encloses(polygon, point)) continue;
      current[column] =
        row === 0 || column === 0
          ? 1
          : Math.min(previous[column]!, current[column - 1]!, previous[column - 1]!) + 1;
      best = Math.max(best, current[column]!);
    }
    previous = current;
  }
  // n sampled points span (n - 1) steps of side.
  return Math.max(0, best - 1) * step;
}

/** Every corner and edge midpoint of a box, which is what must lie in a cell. */
function frameOf(box: Box, samples = 5): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const along = i / samples;
    points.push({ x: box.x + box.width * along, y: box.y });
    points.push({ x: box.x + box.width * along, y: box.y + box.height });
    points.push({ x: box.x, y: box.y + box.height * along });
    points.push({ x: box.x + box.width, y: box.y + box.height * along });
  }
  return points;
}

function holds(polygon: Polygon, box: Box): boolean {
  return frameOf(box).every((point) => encloses(polygon, point));
}

function byId(map: GameMap): Map<TerritoryId, Territory> {
  return new Map(map.territories.map((territory) => [territory.id, territory]));
}

/** The territories reachable from one, over land only. */
function reachedByGround(map: GameMap, from: TerritoryId, within?: Set<TerritoryId>): Set<TerritoryId> {
  const territories = byId(map);
  const seen = new Set<TerritoryId>([from]);
  const queue = [from];
  while (queue.length > 0) {
    const here = queue.shift()!;
    for (const next of territories.get(here)?.neighbours ?? []) {
      if (seen.has(next)) continue;
      if (within && !within.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

/** Borders crossed on the shortest land route, or Infinity if there is none. */
function groundDistance(map: GameMap, from: TerritoryId, to: TerritoryId): number {
  const territories = byId(map);
  const seen = new Set<TerritoryId>([from]);
  let edge = [from];
  let steps = 0;
  while (edge.length > 0) {
    if (edge.includes(to)) return steps;
    const next: TerritoryId[] = [];
    for (const here of edge) {
      for (const neighbour of territories.get(here)?.neighbours ?? []) {
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    edge = next;
    steps += 1;
  }
  return Infinity;
}

describe("the world", () => {
  it("is a valid map", () => {
    expect(() => validateMap(worldMap)).not.toThrow();
  });

  it("holds six continents and thirty territories", () => {
    expect(worldMap.continents).toHaveLength(6);
    expect(worldMap.territories).toHaveLength(30);
  });

  it("gives every continent between four and seven territories, and a bonus", () => {
    for (const continent of worldMap.continents) {
      const held = worldMap.territories.filter(
        (territory) => territory.continent === continent.id,
      );
      expect(
        held.length,
        `${continent.name} holds ${held.length} territories`,
      ).toBeGreaterThanOrEqual(4);
      expect(held.length).toBeLessThanOrEqual(7);
      expect(continent.bonus).toBeGreaterThan(0);
    }
  });
});

describe("the world as a board that can be played out", () => {
  it("lets an army reach every territory from any other, so conquest can finish", () => {
    const first = worldMap.territories[0]!.id;
    const reached = reachedByGround(worldMap, first);
    const missed = worldMap.territories
      .map((territory) => territory.id)
      .filter((id) => !reached.has(id));
    expect(missed, `unreachable by ground from ${first}`).toEqual([]);
  });

  it("connects each continent within itself, so holding one is holding one thing", () => {
    for (const continent of worldMap.continents) {
      const within = new Set(
        worldMap.territories
          .filter((territory) => territory.continent === continent.id)
          .map((territory) => territory.id),
      );
      const from = [...within][0]!;
      const reached = reachedByGround(worldMap, from, within);
      expect(reached.size, `${continent.name} is split into separate pieces`).toBe(within.size);
    }
  });

  it("puts water where only a bomber can cross it", () => {
    const links = worldMap.territories.flatMap((territory) =>
      (territory.seaLinks ?? []).map((across) => [territory.id, across] as const),
    );
    expect(links.length / 2).toBeGreaterThanOrEqual(4);
  });

  it("makes at least one sea link a real shortcut, not a second road", () => {
    const shortcuts = worldMap.territories.flatMap((territory) =>
      (territory.seaLinks ?? []).filter(
        (across) => groundDistance(worldMap, territory.id, across) > 2,
      ),
    );
    expect(
      shortcuts.length,
      "every sea link reaches ground a bomber could already reach overland",
    ).toBeGreaterThan(0);
    for (const territory of worldMap.territories) {
      for (const across of territory.seaLinks ?? []) {
        expect(withinBomberReach(worldMap, territory.id, across)).toBe(true);
      }
    }
  });
});

describe("the world as a picture on a phone", () => {
  it("is portrait, in the proportions an upright phone shows whole", () => {
    const ratio = worldMap.height / worldMap.width;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.8);
  });

  it("keeps every shape inside the board", () => {
    for (const territory of worldMap.territories) {
      for (const point of territory.shape) {
        expect(point.x, `${territory.id} runs off the left or right`).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(worldMap.width);
        expect(point.y, `${territory.id} runs off the top or bottom`).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(worldMap.height);
      }
    }
  });

  it("never lets two cells cover the same ground", () => {
    // Offset off the lattice, so a sample never lands on a shared border where
    // ray casting cannot say which side it is on.
    const step = 1;
    const offset = 0.3137;
    const overlaps: string[] = [];
    for (let x = offset; x < worldMap.width; x += step) {
      for (let y = offset; y < worldMap.height; y += step) {
        const covering = worldMap.territories.filter((territory) =>
          encloses(territory.shape, { x, y }),
        );
        if (covering.length > 1) {
          overlaps.push(`${covering.map((t) => t.id).join("+")} at ${x},${y}`);
        }
      }
    }
    expect(overlaps.slice(0, 5)).toEqual([]);
  });

  it("leaves water between the land, so continents read as continents", () => {
    const step = 1;
    const offset = 0.3137;
    let land = 0;
    let all = 0;
    for (let x = offset; x < worldMap.width; x += step) {
      for (let y = offset; y < worldMap.height; y += step) {
        all += 1;
        if (worldMap.territories.some((territory) => encloses(territory.shape, { x, y }))) {
          land += 1;
        }
      }
    }
    const sea = 1 - land / all;
    expect(sea, "the board is nearly all land").toBeGreaterThan(0.12);
    expect(sea, "the board is mostly water").toBeLessThan(0.5);
  });

  it("gives every cell room for a thumb", () => {
    const tooSmall: string[] = [];
    for (const territory of worldMap.territories) {
      const side = largestSquareIn(territory.shape) * scale;
      if (side < THUMB) tooSmall.push(`${territory.id} admits only ${side.toFixed(1)}px`);
    }
    expect(tooSmall).toEqual([]);
  });
});

/**
 * What the renderer draws in a cell, read back off the SVG it produces and
 * sized by the stylesheet's own numbers, so the question asked is the one a
 * player meets: does the label stay inside the ground it names.
 */
const SHEET = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

function fontSize(selector: string): number {
  const rule = new RegExp(`${selector}\\s*\\{[^}]*font-size:\\s*([\\d.]+)px`).exec(SHEET);
  if (!rule) throw new Error(`no font-size for ${selector} in src/styles.css`);
  return Number(rule[1]);
}

/**
 * Text width, estimated at 0.55 of the font size per character for names and
 * 0.6 for the bold counts. An estimate is what is available without a text
 * engine; it is close enough to catch a label that overruns its cell.
 */
function textBox(text: string, at: Point, size: number, anchor: "middle" | "start", per: number): Box {
  const width = text.length * size * per;
  return {
    x: anchor === "middle" ? at.x - width / 2 : at.x,
    y: at.y - size * 0.8,
    width,
    height: size,
  };
}

function transformed(icon: SVGElement): Box {
  const moved = /translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)/.exec(
    icon.getAttribute("transform") ?? "",
  );
  if (!moved) throw new Error(`icon has no placement: ${icon.getAttribute("transform")}`);
  const [x, y, size] = [Number(moved[1]), Number(moved[2]), Number(moved[3])];
  const numbers = [...(icon.getAttribute("d") ?? "").matchAll(/(-?[\d.]+) (-?[\d.]+)/g)];
  const xs = numbers.map((pair) => Number(pair[1]));
  const ys = numbers.map((pair) => Number(pair[2]));
  return {
    x: x + Math.min(...xs) * size,
    y: y + Math.min(...ys) * size,
    width: (Math.max(...xs) - Math.min(...xs)) * size,
    height: (Math.max(...ys) - Math.min(...ys)) * size,
  };
}

describe("the world as the renderer draws it", () => {
  const view = createMapView(worldMap);
  const root = view.element;

  const shapeOf = (id: TerritoryId): Polygon =>
    worldMap.territories.find((territory) => territory.id === id)!.shape;

  it("keeps every territory's name inside the territory", () => {
    const size = fontSize("\\.territory__name");
    const overruns: string[] = [];
    for (const territory of worldMap.territories) {
      const centre = centreOf(territory.shape);
      const name = [...root.querySelectorAll("text.territory__name")].find(
        (text) => text.textContent === territory.name,
      );
      expect(name, `no name drawn for ${territory.id}`).toBeDefined();
      const at = {
        x: Number(name!.getAttribute("x")),
        y: Number(name!.getAttribute("y")),
      };
      expect(at.x).toBeCloseTo(centre.x, 5);
      const box = textBox(territory.name, at, size, "middle", 0.55);
      if (!holds(territory.shape, box)) {
        overruns.push(`${territory.name} (${box.width.toFixed(1)} units wide)`);
      }
    }
    expect(overruns).toEqual([]);
  });

  it("keeps every cell's forces inside the cell, counts and all", () => {
    const sizes = {
      armies: fontSize("\\.territory__armies \\.force__count"),
      bombers: fontSize("\\.territory__bombers \\.force__count"),
    };
    const outside: string[] = [];
    for (const territory of worldMap.territories) {
      for (const force of ["armies", "bombers"] as const) {
        const group = root.querySelector<SVGElement>(`[data-${force}-for="${territory.id}"]`);
        expect(group, `no ${force} drawn for ${territory.id}`).not.toBeNull();
        const icon = group!.querySelector<SVGElement>(".force__icon")!;
        const count = group!.querySelector<SVGElement>(".force__count")!;
        const shape = shapeOf(territory.id);

        if (!holds(shape, transformed(icon))) outside.push(`${territory.id}: ${force} icon`);
        // Two digits: a cell holding ten or more armies is ordinary play.
        const box = textBox(
          "00",
          { x: Number(count.getAttribute("x")), y: Number(count.getAttribute("y")) },
          sizes[force],
          "start",
          0.6,
        );
        // The count is centred on its line rather than sitting on a baseline.
        const centred = { ...box, y: box.y + sizes[force] * 0.3 };
        if (!holds(shape, centred)) outside.push(`${territory.id}: ${force} count`);
      }
    }
    expect(outside).toEqual([]);
  });
});

describe("the built game", () => {
  const bundle = (): string => {
    const assets = join(process.cwd(), "dist", "assets");
    return readdirSync(assets)
      .filter((name) => name.endsWith(".js"))
      .map((name) => readFileSync(join(assets, name), "utf8"))
      .join("\n");
  };

  it("is played on the world", () => {
    expect(bundle()).toContain(worldMap.name);
  });

  it("carries no trace of the proving ground", () => {
    expect(bundle()).not.toContain("Proving Ground");
  });
});
