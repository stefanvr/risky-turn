import type { ContinentId, GameMap, Point } from "../domain/map";

/**
 * How far a coast is pulled inside its own continent, in map units: half the
 * width the stroke is drawn at. A border between two continents is one shared
 * edge, so two coasts drawn on it are the same line and only the last painted
 * is ever seen. Pulled in by half a stroke each, the two lines sit against
 * that border from either side and both are visible.
 */
export const COAST_INSET = 1.3;

/**
 * Where each continent meets something that is not itself.
 *
 * Neighbouring territories are authored on a shared lattice, so a border
 * between two of them is exactly the same pair of points in both shapes. An
 * edge that appears twice within a continent is therefore an internal border
 * and an edge that appears once is coast — which is the whole of the
 * calculation, with no geometry to get wrong.
 */
export function coastsOf(map: GameMap, inset = 0): Map<ContinentId, Point[][]> {
  const coasts = new Map<ContinentId, Point[][]>();
  for (const continent of map.continents) {
    const { edges, ground } = outerEdgesOf(map, continent.id);
    const loops = loopsOf(edges);
    coasts.set(
      continent.id,
      inset === 0 ? loops : loops.map((loop) => pulledIn(loop, ground, inset)),
    );
  }
  return coasts;
}

type Edge = readonly [Point, Point];

const at = (point: Point): string => `${point.x},${point.y}`;
const spans = (edge: Edge): string => [at(edge[0]), at(edge[1])].toSorted().join("|");

/**
 * The continent's outer edges, and for each of them the cell it belongs to.
 * That cell is what says which side of an edge is the continent's own ground,
 * without any assumption about which way a loop was walked or whether it is an
 * outer shore or the shore of an inland sea.
 */
function outerEdgesOf(
  map: GameMap,
  continent: ContinentId,
): { edges: Edge[]; ground: Map<string, readonly Point[]> } {
  const seen = new Map<string, { edge: Edge; times: number }>();
  const ground = new Map<string, readonly Point[]>();
  for (const territory of map.territories) {
    if (territory.continent !== continent) continue;
    for (let i = 0; i < territory.shape.length; i += 1) {
      const edge: Edge = [territory.shape[i]!, territory.shape[(i + 1) % territory.shape.length]!];
      const key = spans(edge);
      const already = seen.get(key);
      if (already) already.times += 1;
      else seen.set(key, { edge, times: 1 });
      ground.set(key, territory.shape);
    }
  }
  return {
    edges: [...seen.values()].filter((edge) => edge.times === 1).map((edge) => edge.edge),
    ground,
  };
}

/**
 * How far a corner may travel, in insets. A corner has to move further than
 * the edges meeting at it — the sharper it is, the further — and a spike would
 * otherwise send its point deep into the middle of the continent.
 */
const CORNER_LIMIT = 2;

/**
 * The same loop, moved `by` into the ground it encloses. Each corner lands
 * where its two moved edges cross, so both edges keep their distance from the
 * border rather than only the corner itself doing so.
 */
function pulledIn(loop: Point[], ground: Map<string, readonly Point[]>, by: number): Point[] {
  const normals = loop.map((point, i) =>
    inwardsFrom([point, loop[(i + 1) % loop.length]!], ground),
  );
  return loop.map((point, i) => {
    const before = normals[(i - 1 + loop.length) % loop.length]!;
    const after = normals[i]!;
    const between = { x: before.x + after.x, y: before.y + after.y };
    const opening = 1 + before.x * after.x + before.y * after.y;

    // Two edges doubling back on each other leave no crossing to land on; the
    // corner then keeps to the one side it has.
    const step =
      opening < 1e-6
        ? { x: after.x * by, y: after.y * by }
        : { x: (between.x * by) / opening, y: (between.y * by) / opening };

    const travelled = Math.hypot(step.x, step.y);
    const held = travelled > by * CORNER_LIMIT ? (by * CORNER_LIMIT) / travelled : 1;
    return { x: point.x + step.x * held, y: point.y + step.y * held };
  });
}

/**
 * The unit normal of an edge, pointing into the cell the edge belongs to. The
 * side is decided by stepping off the edge and asking whether that step landed
 * in the cell: a cell's centre would answer wrongly wherever the cell is not
 * convex, and hardly any of them are.
 */
function inwardsFrom(edge: Edge, ground: Map<string, readonly Point[]>): Point {
  const along = { x: edge[1].x - edge[0].x, y: edge[1].y - edge[0].y };
  const length = Math.hypot(along.x, along.y) || 1;
  const normal = { x: -along.y / length, y: along.x / length };

  const shape = ground.get(spans(edge));
  if (shape === undefined) return normal;
  const middle = { x: (edge[0].x + edge[1].x) / 2, y: (edge[0].y + edge[1].y) / 2 };
  const stepped = { x: middle.x + normal.x * PROBE, y: middle.y + normal.y * PROBE };
  return inside(stepped, shape) ? normal : { x: -normal.x, y: -normal.y };
}

/** Far enough off an edge to be off it, near enough to still be beside it. */
const PROBE = 0.01;

/** Whether a point lies inside a shape, by ray casting. */
function inside(point: Point, shape: readonly Point[]): boolean {
  let within = false;
  for (let i = 0, j = shape.length - 1; i < shape.length; j = i++) {
    const here = shape[i]!;
    const there = shape[j]!;
    const straddles = here.y > point.y !== there.y > point.y;
    const crossing = ((there.x - here.x) * (point.y - here.y)) / (there.y - here.y) + here.x;
    if (straddles && point.x < crossing) within = !within;
  }
  return within;
}

/**
 * Stitches loose edges into closed rings. A continent can be one ring or
 * several — an island chain is still one continent — and where a coast pinches
 * to a point, either way round closes, so any unused edge will do.
 */
function loopsOf(edges: readonly Edge[]): Point[][] {
  const leaving = new Map<string, Edge[]>();
  for (const edge of edges) {
    for (const [from, to] of [edge, [edge[1], edge[0]] as Edge]) {
      const out = leaving.get(at(from)) ?? [];
      out.push([from, to]);
      leaving.set(at(from), out);
    }
  }

  const walked = new Set<string>();
  const loops: Point[][] = [];
  for (const edge of edges) {
    if (walked.has(spans(edge))) continue;
    const loop: Point[] = [edge[0]];
    let here = edge[0];
    for (;;) {
      const onwards = (leaving.get(at(here)) ?? []).find((next) => !walked.has(spans(next)));
      if (onwards === undefined) break;
      walked.add(spans(onwards));
      here = onwards[1];
      if (at(here) === at(loop[0]!)) break;
      loop.push(here);
    }
    if (loop.length > 2) loops.push(loop);
  }
  return loops;
}
