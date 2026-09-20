import type { Dice } from "./dice";

export interface Contest {
  /** Armies standing in the attacking territory, including the one that stays. */
  readonly attacking: number;
  /** Armies standing in the defending territory. */
  readonly defending: number;
  /** Whether a defensive line holds the defending territory. */
  readonly dugIn?: boolean;
}

export interface DiceCount {
  readonly attacker: number;
  readonly defender: number;
}

export interface Battle {
  readonly attackerDice: readonly number[];
  readonly defenderDice: readonly number[];
  readonly attackerLosses: number;
  readonly defenderLosses: number;
}

const MAX_ATTACK_DICE = 3;
const MAX_DEFEND_DICE = 2;
const MAX_DEFEND_DICE_BEHIND_A_LINE = 3;

/**
 * An attacker must leave one army behind, so it rolls one die per army beyond
 * that, to three. A defender rolls one per army, to two.
 */
export function diceFor(contest: Contest): DiceCount {
  return {
    attacker: Math.min(MAX_ATTACK_DICE, Math.max(0, contest.attacking - 1)),
    defender: Math.min(
      contest.dugIn === true ? MAX_DEFEND_DICE_BEHIND_A_LINE : MAX_DEFEND_DICE,
      Math.max(0, contest.defending),
    ),
  };
}

/**
 * Rolls one exchange. Dice are sorted and compared highest against highest;
 * the defender takes ties, which is what makes defending worth doing. A
 * defender behind a line rolls one more die than usual.
 */
export function resolveBattle(contest: Contest, dice: Dice): Battle {
  const count = diceFor(contest);
  const attackerDice = rollDescending(count.attacker, dice);
  const defenderDice = rollDescending(count.defender, dice);

  let attackerLosses = 0;
  let defenderLosses = 0;
  const pairs = Math.min(attackerDice.length, defenderDice.length);
  for (let index = 0; index < pairs; index += 1) {
    if (attackerDice[index]! > defenderDice[index]!) defenderLosses += 1;
    else attackerLosses += 1;
  }

  return { attackerDice, defenderDice, attackerLosses, defenderLosses };
}

function rollDescending(count: number, dice: Dice): number[] {
  return Array.from({ length: count }, () => dice.roll()).sort((a, b) => b - a);
}
