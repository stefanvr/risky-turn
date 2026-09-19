/**
 * The map is plain data: no rendering, no interaction, no game state.
 * Everything that later decides reinforcements, borders or victory reads it
 * from here, so an invalid map must never reach them.
 */

export type TerritoryId = string;
export type ContinentId = string;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Territory {
  readonly id: TerritoryId;
  readonly name: string;
  readonly continent: ContinentId;
  /** Territories an army may attack or move into from here. Always mutual. */
  readonly neighbours: readonly TerritoryId[];
  /** Outline in map coordinates, bounded by the map's width and height. */
  readonly shape: readonly Point[];
}

export interface Continent {
  readonly id: ContinentId;
  readonly name: string;
  /** Extra reinforcements for a player holding every territory in it. */
  readonly bonus: number;
}

export interface GameMap {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly continents: readonly Continent[];
  readonly territories: readonly Territory[];
}

export class InvalidMapError extends Error {
  override readonly name = "InvalidMapError";
}

/**
 * Returns the map unchanged, or throws describing the first fault found.
 * A malformed map is a mistake in authored data, not a runtime condition, so
 * it fails at load rather than producing a plausible but wrong board.
 */
export function validateMap(map: GameMap): GameMap {
  const reject = (reason: string): never => {
    throw new InvalidMapError(`map "${map.id}": ${reason}`);
  };

  const byId = new Map<TerritoryId, Territory>();
  for (const territory of map.territories) {
    if (byId.has(territory.id)) reject(`duplicate territory "${territory.id}"`);
    byId.set(territory.id, territory);
  }

  const continentIds = new Set(map.continents.map((continent) => continent.id));

  for (const territory of map.territories) {
    if (!continentIds.has(territory.continent)) {
      reject(`territory "${territory.id}" is in undefined continent "${territory.continent}"`);
    }
    if (territory.shape.length < 3) {
      reject(`territory "${territory.id}" has no drawable shape`);
    }
    for (const neighbour of territory.neighbours) {
      if (neighbour === territory.id) {
        reject(`territory "${territory.id}" borders itself`);
      }
      const other = byId.get(neighbour);
      if (!other) {
        reject(`territory "${territory.id}" borders unknown territory "${neighbour}"`);
        continue;
      }
      if (!other.neighbours.includes(territory.id)) {
        reject(
          `border "${territory.id}"–"${neighbour}" is not symmetric: ` +
            `"${neighbour}" does not border "${territory.id}"`,
        );
      }
    }
  }

  return map;
}

/** Geometric centre of a shape, used to place a territory's label. */
export function centreOf(shape: readonly Point[]): Point {
  const total = shape.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return { x: total.x / shape.length, y: total.y / shape.length };
}
