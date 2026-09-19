import { seededRandom } from "./random";
import type { Random } from "./random";

/**
 * Dice are an explicit seam. Combat never reaches for randomness itself, so a
 * battle can be replayed exactly — in a test, in a replay, or when reporting a
 * bug.
 */
export interface Dice {
  roll(): number;
}

const FACES = 6;

export function diceFrom(random: Random): Dice {
  return { roll: () => 1 + Math.floor(random.next() * FACES) };
}

/** Deterministic dice from a seed. Same seed, same sequence, every run. */
export function seededDice(seed: number): Dice {
  return diceFrom(seededRandom(seed));
}

/** Dice that hand back the given faces in order, cycling when exhausted. */
export function fixedDice(faces: readonly number[]): Dice {
  if (faces.length === 0) throw new Error("fixedDice needs at least one face");
  let next = 0;
  return {
    roll: () => faces[next++ % faces.length]!,
  };
}
