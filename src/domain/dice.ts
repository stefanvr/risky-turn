/**
 * Dice are an explicit seam. Combat never reaches for randomness itself, so a
 * battle can be replayed exactly — in a test, in a replay, or when reporting a
 * bug.
 */
export interface Dice {
  roll(): number;
}

/** Deterministic dice from a seed. Same seed, same sequence, every run. */
export function seededDice(seed: number): Dice {
  let state = seed >>> 0;
  return {
    roll() {
      // mulberry32: small, fast, and adequate for dice.
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const fraction = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return 1 + Math.floor(fraction * 6);
    },
  };
}

/** Dice that hand back the given faces in order, cycling when exhausted. */
export function fixedDice(faces: readonly number[]): Dice {
  if (faces.length === 0) throw new Error("fixedDice needs at least one face");
  let next = 0;
  return {
    roll: () => faces[next++ % faces.length]!,
  };
}
