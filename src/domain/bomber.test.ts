import { describe, expect, it } from "vitest";
import { attack, bomb, buildBomber, endPhase } from "./turn";
import { BOMBER_COST, BOMBS_KILL_FROM } from "./game";
import { reinforcementsFor } from "./reinforcements";
import { fixedDice } from "./dice";
import { stateWhere } from "./testGames";
import type { GameState, PlayerId } from "./game";
import type { TerritoryId } from "./map";

const board = {
  alfa: "red",
  bravo: "blue",
  charlie: "blue",
  delta: "red",
  echo: "red",
} as const;

const holding = (state: GameState, territory: TerritoryId) => state.holdings.get(territory)!;

function endTurn(state: GameState): GameState {
  let next: GameState = { ...state, reinforcementsLeft: 0 };
  while (next.phase !== "fortify") next = endPhase(next);
  return endPhase(next);
}

function afterOwnTurns(state: GameState, player: PlayerId, count: number): GameState {
  let next = state;
  for (let ended = 0; ended < count; ) {
    const whose = next.currentPlayer;
    next = endTurn(next);
    if (whose === player) ended += 1;
  }
  return next;
}

describe("building a bomber", () => {
  const deploying = (overrides = {}) =>
    stateWhere(board, { reinforcementsLeft: 6, armies: { alfa: 2 }, ...overrides });

  it("costs reinforcements and adds no armies", () => {
    expect(BOMBER_COST).toBe(3);
    const after = buildBomber(deploying(), "alfa");
    expect(holding(after, "alfa").bombers).toBe(1);
    expect(holding(after, "alfa").armies).toBe(2);
    expect(after.reinforcementsLeft).toBe(3);
  });

  it("needs the deploy phase", () => {
    expect(() => buildBomber(deploying({ phase: "attack" }), "alfa")).toThrow(/deploy/i);
  });

  it("needs a territory the player holds", () => {
    expect(() => buildBomber(deploying(), "bravo")).toThrow(/does not hold/i);
  });

  it("needs the reinforcements to pay for it", () => {
    expect(() => buildBomber(deploying({ reinforcementsLeft: 2 }), "alfa")).toThrow(/3/);
  });
});

describe("a bomber is not an army", () => {
  it("is not counted when a turn's reinforcements are worked out", () => {
    const plain = stateWhere(board);
    const withBombers = stateWhere(board, { bombers: { alfa: 4, delta: 4, echo: 4 } });
    expect(reinforcementsFor(withBombers, "red")).toBe(reinforcementsFor(plain, "red"));
  });

  it("does not help defend the ground it stands on", () => {
    const bare = stateWhere(board, {
      phase: "attack",
      currentPlayer: "blue",
      armies: { charlie: 4, delta: 2 },
    });
    const guarded = stateWhere(board, {
      phase: "attack",
      currentPlayer: "blue",
      armies: { charlie: 4, delta: 2 },
      bombers: { delta: 5 },
    });
    const one = attack(bare, "charlie", "delta", fixedDice([6, 5, 4, 1, 1]));
    const other = attack(guarded, "charlie", "delta", fixedDice([6, 5, 4, 1, 1]));
    expect(other.battle).toEqual(one.battle);
  });

  it("is lost with the ground it stands on", () => {
    const state = stateWhere(board, {
      phase: "attack",
      currentPlayer: "blue",
      armies: { charlie: 4, delta: 1 },
      bombers: { delta: 3 },
    });
    const after = attack(state, "charlie", "delta", fixedDice([6, 5, 4, 1]));
    expect(holding(after.state, "delta").owner).toBe("blue");
    expect(holding(after.state, "delta").bombers).toBe(0);
  });
});

describe("a bombing run", () => {
  const armed = (overrides = {}) =>
    stateWhere(board, {
      phase: "attack",
      armies: { alfa: 2, bravo: 4, charlie: 4, delta: 2, echo: 2 },
      bombers: { alfa: 3 },
      ...overrides,
    });

  it("rolls one die per bomber and kills on the high faces", () => {
    expect(BOMBS_KILL_FROM).toBe(5);
    const run = bomb(armed(), "alfa", "bravo", fixedDice([6, 5, 2]));
    expect(run.dice).toEqual([6, 5, 2]);
    expect(run.kills).toBe(2);
    expect(holding(run.state, "bravo").armies).toBe(2);
  });

  it("loses no bomber, whatever the dice say", () => {
    const run = bomb(armed(), "alfa", "bravo", fixedDice([1, 1, 1]));
    expect(run.kills).toBe(0);
    expect(holding(run.state, "alfa").bombers).toBe(3);
  });

  it("never takes a territory below one army, so it cannot conquer", () => {
    const run = bomb(armed({ armies: { alfa: 2, bravo: 2, charlie: 4, delta: 2, echo: 2 } }), "alfa", "bravo", fixedDice([6, 6, 6]));
    expect(run.kills).toBe(1);
    expect(holding(run.state, "bravo").armies).toBe(1);
    expect(holding(run.state, "bravo").owner).toBe("blue");
    expect(run.state.winner).toBeNull();
  });

  it("needs the attack phase", () => {
    expect(() => bomb(armed({ phase: "deploy" }), "alfa", "bravo", fixedDice([6]))).toThrow(/attack/i);
  });

  it("needs a bomber to fly", () => {
    expect(() => bomb(armed({ bombers: {} }), "alfa", "bravo", fixedDice([6]))).toThrow(/no bomber/i);
  });

  it("will not bomb the player's own ground", () => {
    expect(() => bomb(armed(), "alfa", "delta", fixedDice([6]))).toThrow(/own/i);
  });

  it("will not bomb beyond reach", () => {
    expect(() => bomb(armed(), "alfa", "bravo", fixedDice([6]))).not.toThrow();
  });

  it("flies once a turn from one territory", () => {
    const flown = bomb(armed(), "alfa", "bravo", fixedDice([1, 1, 1])).state;
    expect(() => bomb(flown, "alfa", "bravo", fixedDice([1, 1, 1]))).toThrow(/already flown/i);
  });

  it("flies again when its own turn comes round", () => {
    const flown = bomb(armed(), "alfa", "bravo", fixedDice([1, 1, 1])).state;
    expect(holding(flown, "alfa").bombersFlown).toBe(true);

    // Red ends this turn, Blue takes one, and Red's turn begins again.
    const redAgain = afterOwnTurns(flown, "blue", 1);
    expect(redAgain.currentPlayer).toBe("red");
    expect(holding(redAgain, "alfa").bombersFlown).toBe(false);
  });

  it("leaves a defensive line to collapse on its own once the garrison thins", () => {
    const lined = armed({
      armies: { alfa: 2, bravo: 5, charlie: 4, delta: 2, echo: 2 },
      lines: { bravo: 0 },
    });
    const run = bomb(lined, "alfa", "bravo", fixedDice([6, 6, 2]));
    expect(holding(run.state, "bravo").armies).toBe(3);
    expect(holding(run.state, "bravo").line).toBeNull();
  });
});
