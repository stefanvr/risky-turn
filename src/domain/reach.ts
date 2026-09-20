import type { GameMap, TerritoryId } from "./map";

/*
 * PROVISIONAL: a bomber reaches two borders. One border would make it a
 * slightly odd army; three would let it strike almost anywhere on a small map
 * and make position stop mattering.
 */
export const BOMBER_REACH = 2;

/**
 * Whether a bomber standing in `from` can strike `to`: within reach over land,
 * or directly across water.
 *
 * A sea link is a destination, not a road. Crossing water and then continuing
 * overland would make a single link open up half a map, which is not what the
 * link is for.
 */
export function withinBomberReach(
  map: GameMap,
  from: TerritoryId,
  to: TerritoryId,
): boolean {
  if (from === to) return false;

  const at = (id: TerritoryId) => map.territories.find((territory) => territory.id === id);
  if ((at(from)?.seaLinks ?? []).includes(to)) return true;

  let frontier: TerritoryId[] = [from];
  const seen = new Set<TerritoryId>([from]);

  for (let step = 0; step < BOMBER_REACH; step += 1) {
    const next: TerritoryId[] = [];
    for (const here of frontier) {
      for (const neighbour of at(here)?.neighbours ?? []) {
        if (neighbour === to) return true;
        if (seen.has(neighbour)) continue;
        seen.add(neighbour);
        next.push(neighbour);
      }
    }
    frontier = next;
  }
  return false;
}
