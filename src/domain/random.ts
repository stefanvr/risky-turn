/**
 * Randomness is an explicit seam. Nothing in the domain reaches for Math.random,
 * so a game can be replayed exactly from its seed.
 */
export interface Random {
  /** A number in [0, 1). */
  next(): number;
}

export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return {
    next() {
      // mulberry32: small, fast, and adequate for a board game.
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** A whole number in [0, bound). */
export function below(random: Random, bound: number): number {
  return Math.floor(random.next() * bound);
}

/** Fisher-Yates, so a shuffle from a given seed is always the same shuffle. */
export function shuffled<T>(items: readonly T[], random: Random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = below(random, index + 1);
    [result[index], result[swap]] = [result[swap]!, result[index]!];
  }
  return result;
}
