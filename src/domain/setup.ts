import { shuffled } from "./random";
import { reinforcementsFor } from "./reinforcements";
import { validateMap } from "./map";
import type { GameMap, TerritoryId } from "./map";
import type { GameState, Holding, PlayerId } from "./game";
import type { Random } from "./random";

/*
 * PROVISIONAL: every player opens with twice as many armies as the largest
 * share of territories. On the proving map that is six each; on a
 * forty-territory map with two players it lands near the forty of the classic
 * game. It decides how long an opening lasts, which is easier to judge once a
 * full game has been played through.
 */
const ARMIES_PER_TERRITORY_SHARE = 2;

/**
 * Deals a map out between players: territories shared as evenly as they
 * divide, one army standing on each, and the rest of a player's opening armies
 * spread over what they hold. Every player starts with the same army count,
 * whatever the map's territory count does or does not divide by.
 */
export function newGame(
  map: GameMap,
  players: readonly PlayerId[],
  random: Random,
): GameState {
  validateMap(map);
  if (players.length < 2) throw new Error("a game needs at least two players");

  const order = shuffled(
    map.territories.map((territory) => territory.id),
    random,
  );

  const claims = new Map<PlayerId, TerritoryId[]>(players.map((player) => [player, []]));
  order.forEach((territory, index) => {
    claims.get(players[index % players.length]!)!.push(territory);
  });

  const largestShare = Math.ceil(map.territories.length / players.length);
  const armiesEach = largestShare * ARMIES_PER_TERRITORY_SHARE;

  const armies = new Map<TerritoryId, number>();
  for (const [, held] of claims) {
    for (const territory of held) armies.set(territory, 1);
    for (let placed = held.length; placed < armiesEach; placed += 1) {
      const territory = held[(placed - held.length) % held.length]!;
      armies.set(territory, armies.get(territory)! + 1);
    }
  }

  const holdings = new Map<TerritoryId, Holding>();
  for (const territory of map.territories) {
    const owner = players.find((player) => claims.get(player)!.includes(territory.id))!;
    holdings.set(territory.id, { owner, armies: armies.get(territory.id)! });
  }

  const opening: GameState = {
    map,
    players,
    holdings,
    currentPlayer: players[0]!,
    phase: "deploy",
    reinforcementsLeft: 0,
    hasFortified: false,
    winner: null,
  };
  return { ...opening, reinforcementsLeft: reinforcementsFor(opening, players[0]!) };
}
