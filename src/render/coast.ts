import type { ContinentId, GameMap, Point } from "../domain/map";

/**
 * Where each continent meets something that is not itself.
 *
 * Neighbouring territories are authored on a shared lattice, so a border
 * between two of them is exactly the same pair of points in both shapes. An
 * edge that appears twice within a continent is therefore an internal border
 * and an edge that appears once is coast — which is the whole of the
 * calculation, with no geometry to get wrong.
 */
export function coastsOf(map: GameMap): Map<ContinentId, Point[][]> {
  const coasts = new Map<ContinentId, Point[][]>();
  for (const continent of map.continents) {
    coasts.set(continent.id, loopsOf(outerEdgesOf(map, continent.id)));
  }
  return coasts;
}

type Edge = readonly [Point, Point];

const at = (point: Point): string => `${point.x},${point.y}`;
const spans = (edge: Edge): string => [at(edge[0]), at(edge[1])].toSorted().join("|");

function outerEdgesOf(map: GameMap, continent: ContinentId): Edge[] {
  const seen = new Map<string, { edge: Edge; times: number }>();
  for (const territory of map.territories) {
    if (territory.continent !== continent) continue;
    for (let i = 0; i < territory.shape.length; i += 1) {
      const edge: Edge = [territory.shape[i]!, territory.shape[(i + 1) % territory.shape.length]!];
      const key = spans(edge);
      const already = seen.get(key);
      if (already) already.times += 1;
      else seen.set(key, { edge, times: 1 });
    }
  }
  return [...seen.values()].filter((edge) => edge.times === 1).map((edge) => edge.edge);
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
