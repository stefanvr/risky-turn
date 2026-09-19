import { describe, expect, it } from "vitest";
import { IllegalMoveError, attack, deploy, endPhase, fortify } from "./turn";
import { fixedDice } from "./dice";
import { stateWhere } from "./testGames";

const board = {
  alfa: "red",
  bravo: "blue",
  charlie: "blue",
  delta: "red",
  echo: "red",
} as const;

describe("deploying reinforcements", () => {
  it("adds armies to a territory the player holds", () => {
    const state = stateWhere(board, { armies: { alfa: 1 }, reinforcementsLeft: 3 });
    const after = deploy(state, "alfa", 2);
    expect(after.holdings.get("alfa")?.armies).toBe(3);
    expect(after.reinforcementsLeft).toBe(1);
  });

  it("refuses to deploy onto a territory the player does not hold", () => {
    const state = stateWhere(board, { reinforcementsLeft: 3 });
    expect(() => deploy(state, "bravo", 1)).toThrow(IllegalMoveError);
  });

  it("refuses to deploy more armies than remain", () => {
    const state = stateWhere(board, { reinforcementsLeft: 2 });
    expect(() => deploy(state, "alfa", 3)).toThrow(/2/);
  });

  it("says plainly that there is nothing left to place", () => {
    const state = stateWhere(board, { reinforcementsLeft: 0 });
    expect(() => deploy(state, "alfa", 1)).toThrow(/no reinforcements left/i);
  });

  it("refuses to leave the deploy phase with armies still in hand", () => {
    const state = stateWhere(board, { reinforcementsLeft: 1 });
    expect(() => endPhase(state)).toThrow(IllegalMoveError);
  });
});

describe("attacking", () => {
  const ready = (overrides = {}) =>
    stateWhere(board, {
      phase: "attack",
      armies: { alfa: 4, bravo: 3, charlie: 3, delta: 2, echo: 1 },
      ...overrides,
    });

  it("refuses an attack from a territory the player does not hold", () => {
    expect(() => attack(ready(), "bravo", "alfa", fixedDice([6]))).toThrow(/hold/i);
  });

  it("refuses an attack on a territory the player already holds", () => {
    expect(() => attack(ready(), "delta", "echo", fixedDice([6]))).toThrow(/own/i);
  });

  it("refuses an attack between territories that do not border", () => {
    expect(() => attack(ready(), "alfa", "charlie", fixedDice([6]))).not.toThrow();
    expect(() => attack(ready(), "delta", "bravo", fixedDice([6]))).toThrow(/border/i);
  });

  it("refuses an attack from a territory holding a single army", () => {
    const thin = ready({ armies: { alfa: 1, bravo: 3, charlie: 3, delta: 2, echo: 1 } });
    expect(() => attack(thin, "alfa", "bravo", fixedDice([6]))).toThrow(/at least two/i);
  });

  it("removes the losing side's army without changing who holds what", () => {
    const after = attack(ready(), "alfa", "bravo", fixedDice([6, 5, 4, 1, 1]));
    expect(after.state.holdings.get("bravo")?.owner).toBe("blue");
    expect(after.state.holdings.get("bravo")?.armies).toBe(1);
    expect(after.conquered).toBe(false);
  });

  it("transfers the territory when the last defending army falls", () => {
    const state = ready({ armies: { alfa: 4, bravo: 1, charlie: 3, delta: 2, echo: 1 } });
    const after = attack(state, "alfa", "bravo", fixedDice([6, 5, 4, 1]));
    expect(after.state.holdings.get("bravo")?.owner).toBe("red");
    expect(after.conquered).toBe(true);
  });

  it("leaves one army behind when it moves into a conquered territory", () => {
    const state = ready({ armies: { alfa: 4, bravo: 1, charlie: 3, delta: 2, echo: 1 } });
    const after = attack(state, "alfa", "bravo", fixedDice([6, 5, 4, 1]));
    expect(after.state.holdings.get("alfa")?.armies).toBe(1);
    expect(after.state.holdings.get("bravo")?.armies).toBe(3);
  });

  it("ends the game once one player holds every territory", () => {
    const nearlyWon = stateWhere(
      { alfa: "red", bravo: "blue", charlie: "red", delta: "red", echo: "red" },
      { phase: "attack", armies: { alfa: 4, bravo: 1, charlie: 3, delta: 2, echo: 1 } },
    );
    const after = attack(nearlyWon, "alfa", "bravo", fixedDice([6, 5, 4, 1]));
    expect(after.state.winner).toBe("red");
  });
});

describe("fortifying", () => {
  const ready = () =>
    stateWhere(board, {
      phase: "fortify",
      armies: { alfa: 1, bravo: 1, charlie: 1, delta: 4, echo: 1 },
    });

  it("moves armies between the player's own territories that border each other", () => {
    const after = fortify(ready(), "delta", "echo", 3);
    expect(after.holdings.get("delta")?.armies).toBe(1);
    expect(after.holdings.get("echo")?.armies).toBe(4);
  });

  it("refuses to move the last army out of a territory", () => {
    expect(() => fortify(ready(), "delta", "echo", 4)).toThrow(IllegalMoveError);
  });

  it("refuses a move to a territory the player does not hold", () => {
    expect(() => fortify(ready(), "delta", "charlie", 1)).toThrow(/hold/i);
  });

  it("refuses a move between own territories with no own path between them", () => {
    // red holds alfa, delta and echo; alfa reaches the others only through
    // charlie, which blue holds.
    expect(() => fortify(ready(), "delta", "alfa", 1)).toThrow(/path|connected/i);
  });

  it("allows only one fortify in a turn", () => {
    const once = fortify(ready(), "delta", "echo", 2);
    expect(() => fortify(once, "delta", "echo", 1)).toThrow(/only one fortify/i);
  });
});

describe("the shape of a turn", () => {
  it("runs deploy, then attack, then fortify, then passes to the next player", () => {
    const state = stateWhere(board, { reinforcementsLeft: 0 });
    expect(state.phase).toBe("deploy");
    const attacking = endPhase(state);
    expect(attacking.phase).toBe("attack");
    const fortifying = endPhase(attacking);
    expect(fortifying.phase).toBe("fortify");
    const next = endPhase(fortifying);
    expect(next.phase).toBe("deploy");
    expect(next.currentPlayer).toBe("blue");
  });

  it("hands the new player their reinforcements at the start of their turn", () => {
    const state = stateWhere(board, { phase: "fortify" });
    const next = endPhase(state);
    expect(next.currentPlayer).toBe("blue");
    expect(next.reinforcementsLeft).toBe(3);
  });

  it("skips a player who has been driven off the map", () => {
    const state = stateWhere(
      { alfa: "red", bravo: "green", charlie: "red", delta: "red", echo: "red" },
      { players: ["red", "blue", "green"], phase: "fortify", currentPlayer: "red" },
    );
    expect(endPhase(state).currentPlayer).toBe("green");
  });
});
