import { territoriesOf } from "./game";
import type { GameState, PlayerId } from "./game";

/** However small an empire gets, a turn is worth at least this many armies. */
export const REINFORCEMENT_FLOOR = 3;
export const TERRITORIES_PER_ARMY = 3;

/**
 * Armies a player receives at the start of their turn: one per three
 * territories held, never fewer than three, plus the bonus of every continent
 * they hold outright. A player who holds nothing receives nothing — they are
 * out of the game, not merely poor.
 */
export function reinforcementsFor(state: GameState, player: PlayerId): number {
  const held = territoriesOf(state, player);
  if (held.length === 0) return 0;

  const fromTerritories = Math.max(
    REINFORCEMENT_FLOOR,
    Math.floor(held.length / TERRITORIES_PER_ARMY),
  );
  return fromTerritories + continentBonus(state, player);
}

function continentBonus(state: GameState, player: PlayerId): number {
  return state.map.continents.reduce((bonus, continent) => {
    const territories = state.map.territories.filter(
      (territory) => territory.continent === continent.id,
    );
    const holdsAll = territories.every(
      (territory) => state.holdings.get(territory.id)?.owner === player,
    );
    return holdsAll ? bonus + continent.bonus : bonus;
  }, 0);
}
