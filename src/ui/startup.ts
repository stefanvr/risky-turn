import { newGame } from "../domain/setup";
import { seededRandom } from "../domain/random";
import type { GameMap } from "../domain/map";
import type { GameState, PlayerId } from "../domain/game";

/** Resolves a named position. Absent in a production build. */
export type FixtureResolver = (
  name: string,
  map: GameMap,
  players: readonly PlayerId[],
) => GameState;

export interface StartupOptions {
  readonly map: GameMap;
  readonly players: readonly PlayerId[];
  /**
   * Supplied only in a development build. Passing the resolver rather than a
   * flag is what lets the bundler drop the fixtures entirely from production:
   * nothing references them, so nothing ships.
   */
  readonly fixtures?: FixtureResolver | undefined;
  /** Time is an input: the fallback seed comes from here, not from the clock. */
  readonly now: () => number;
}

export interface Startup {
  readonly state: GameState;
  readonly seed: number;
}

/**
 * Decides which game the page opens on, from the address it was opened at.
 *
 * `?seed=` makes a deal reproducible; without it the clock supplies one.
 * `?fixture=` puts a named position on the board and is refused unless the
 * gate is open.
 */
export function chooseStartingState(search: string, options: StartupOptions): Startup {
  const parameters = new URLSearchParams(search);

  const given = Number(parameters.get("seed"));
  const seed = Number.isFinite(given) && parameters.get("seed") !== null && given !== 0
    ? given
    : options.now();

  const fixture = parameters.get("fixture");
  if (fixture !== null && options.fixtures !== undefined) {
    return { state: options.fixtures(fixture, options.map, options.players), seed };
  }

  return {
    state: newGame(options.map, options.players, seededRandom(seed)),
    seed,
  };
}
