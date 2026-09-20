import { describe, expect, it } from "vitest";
import { diceFor, resolveBattle } from "./combat";
import { fixedDice, seededDice } from "./dice";

describe("how many dice a battle is fought with", () => {
  it("lets the attacker roll one die per army beyond the one left behind, up to three", () => {
    expect(diceFor({ attacking: 2, defending: 9 }).attacker).toBe(1);
    expect(diceFor({ attacking: 3, defending: 9 }).attacker).toBe(2);
    expect(diceFor({ attacking: 4, defending: 9 }).attacker).toBe(3);
    expect(diceFor({ attacking: 9, defending: 9 }).attacker).toBe(3);
  });

  it("lets the defender roll one die per defending army, up to two", () => {
    expect(diceFor({ attacking: 9, defending: 1 }).defender).toBe(1);
    expect(diceFor({ attacking: 9, defending: 5 }).defender).toBe(2);
  });

  it("lets a defender behind a line roll a third die", () => {
    expect(diceFor({ attacking: 9, defending: 5, dugIn: true }).defender).toBe(3);
  });

  it("never lets a line conjure dice out of armies that are not there", () => {
    expect(diceFor({ attacking: 9, defending: 2, dugIn: true }).defender).toBe(2);
    expect(diceFor({ attacking: 9, defending: 1, dugIn: true }).defender).toBe(1);
  });
});

describe("resolving a battle", () => {
  it("compares the highest dice against each other and the next highest after that", () => {
    const battle = resolveBattle({ attacking: 4, defending: 2 }, fixedDice([6, 5, 1, 4, 3]));
    expect(battle.attackerDice).toEqual([6, 5, 1]);
    expect(battle.defenderDice).toEqual([4, 3]);
    expect(battle.defenderLosses).toBe(2);
    expect(battle.attackerLosses).toBe(0);
  });

  it("gives a tie to the defender", () => {
    const battle = resolveBattle({ attacking: 2, defending: 1 }, fixedDice([3, 3]));
    expect(battle.attackerLosses).toBe(1);
    expect(battle.defenderLosses).toBe(0);
  });

  it("settles only as many pairs as the smaller side has dice", () => {
    const battle = resolveBattle({ attacking: 4, defending: 1 }, fixedDice([6, 6, 6, 1]));
    expect(battle.attackerLosses + battle.defenderLosses).toBe(1);
    expect(battle.defenderLosses).toBe(1);
  });

  it("splits losses when each side wins a pair", () => {
    const battle = resolveBattle({ attacking: 3, defending: 2 }, fixedDice([6, 1, 2, 5]));
    expect(battle.defenderLosses).toBe(1);
    expect(battle.attackerLosses).toBe(1);
  });
});

describe("reproducibility", () => {
  it("gives the same battle twice for the same seed", () => {
    const first = resolveBattle({ attacking: 4, defending: 2 }, seededDice(1234));
    const second = resolveBattle({ attacking: 4, defending: 2 }, seededDice(1234));
    expect(first).toEqual(second);
  });
});
