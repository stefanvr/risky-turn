import { describe, expect, it } from "vitest";
import { attack, digIn, endPhase, fortify } from "./turn";
import { lineIsHolding, LINE_MINIMUM_GARRISON } from "./game";
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

const garrisoned = (overrides = {}): GameState =>
  stateWhere(board, {
    phase: "fortify",
    armies: { alfa: 2, bravo: 2, charlie: 2, delta: 6, echo: 1 },
    ...overrides,
  });

const holding = (state: GameState, territory: TerritoryId) =>
  state.holdings.get(territory)!;

/** Ends the turn in progress, whatever phase it is in. */
function endTurn(state: GameState): GameState {
  let next: GameState = { ...state, reinforcementsLeft: 0 };
  while (next.phase !== "fortify") next = endPhase(next);
  return endPhase(next);
}

/** Ends whole turns until `player` has ended `count` turns of their own. */
function afterOwnTurns(state: GameState, player: PlayerId, count: number): GameState {
  let next = state;
  for (let ended = 0; ended < count; ) {
    const whose = next.currentPlayer;
    next = endTurn(next);
    if (whose === player) ended += 1;
  }
  return next;
}

const asPlayer = (state: GameState, player: PlayerId, phase: GameState["phase"]) => ({
  ...state,
  currentPlayer: player,
  phase,
  hasFortified: false,
});

describe("digging in", () => {
  it("needs the fortify phase", () => {
    expect(() => digIn(garrisoned({ phase: "attack" }), "delta")).toThrow(/fortify/i);
  });

  it("needs a territory the player holds", () => {
    expect(() => digIn(garrisoned(), "bravo")).toThrow(/does not hold/i);
  });

  it("needs a full garrison standing there", () => {
    expect(LINE_MINIMUM_GARRISON).toBe(5);
    expect(() => digIn(garrisoned(), "alfa")).toThrow(/5 armies/i);
  });

  it("costs the turn's fortify", () => {
    const dug = digIn(garrisoned(), "delta");
    expect(() => fortify(dug, "delta", "echo", 1)).toThrow(/only one fortify/i);
  });

  it("cannot be done twice in a turn", () => {
    const wellHeld = garrisoned({
      armies: { alfa: 2, bravo: 2, charlie: 2, delta: 6, echo: 6 },
    });
    expect(() => digIn(digIn(wellHeld, "delta"), "echo")).toThrow(/only one fortify/i);
  });

  it("cannot be done where a line already stands", () => {
    const dug = digIn(garrisoned(), "delta");
    const backToRed = afterOwnTurns(dug, "blue", 1);
    expect(() => digIn(asPlayer(backToRed, "red", "fortify"), "delta")).toThrow(/already/i);
  });
});

describe("when a line starts protecting", () => {
  it("does not protect during the round that follows it being declared", () => {
    const dug = digIn(garrisoned(), "delta");
    expect(lineIsHolding(holding(dug, "delta"))).toBe(false);

    const opponentsWindow = afterOwnTurns(dug, "red", 1);
    expect(lineIsHolding(holding(opponentsWindow, "delta"))).toBe(false);
  });

  it("protects from the end of the declaring player's next turn", () => {
    const dug = digIn(garrisoned(), "delta");
    const hardened = afterOwnTurns(dug, "red", 2);
    expect(lineIsHolding(holding(hardened, "delta"))).toBe(true);
  });

  it("does not arm on another player's turns alone", () => {
    const dug = digIn(garrisoned(), "delta");
    const afterRedThenBlue = afterOwnTurns(dug, "blue", 1);
    expect(lineIsHolding(holding(afterRedThenBlue, "delta"))).toBe(false);
  });
});

describe("what a line does", () => {
  it("lets the defender roll three dice instead of two", () => {
    const hardened = afterOwnTurns(digIn(garrisoned(), "delta"), "red", 2);
    const assault = asPlayer(hardened, "blue", "attack");
    const result = attack(assault, "charlie", "delta", fixedDice([6, 6, 5, 4, 3]));
    expect(result.battle.defenderDice).toHaveLength(3);
  });

  it("rolls only two dice where no line holds", () => {
    const assault = asPlayer(garrisoned(), "blue", "attack");
    const result = attack(assault, "charlie", "delta", fixedDice([6, 6, 5, 4, 3]));
    expect(result.battle.defenderDice).toHaveLength(2);
  });
});

describe("finding a line", () => {
  it("is not known to anyone until something runs into it", () => {
    const dug = digIn(garrisoned(), "delta");
    expect(holding(dug, "delta").line?.revealed).toBe(false);
  });

  it("is known once an attack runs into it, and stays known", () => {
    const hardened = afterOwnTurns(digIn(garrisoned(), "delta"), "red", 2);
    const assault = asPlayer(hardened, "blue", "attack");
    const after = attack(assault, "charlie", "delta", fixedDice([1, 6, 6, 6]));

    expect(holding(after.state, "delta").owner).toBe("red");
    expect(holding(after.state, "delta").line?.revealed).toBe(true);

    const laterStill = afterOwnTurns(after.state, "red", 1);
    expect(holding(laterStill, "delta").line?.revealed).toBe(true);
  });
});

describe("how a line collapses", () => {
  it("falls when the garrison drops below a full one", () => {
    const hardened = afterOwnTurns(digIn(garrisoned(), "delta"), "red", 2);
    const moved = fortify(asPlayer(hardened, "red", "fortify"), "delta", "echo", 2);
    expect(holding(moved, "delta").armies).toBe(4);
    expect(holding(moved, "delta").line).toBeNull();
  });

  it("falls when the player attacks out of it", () => {
    const hardened = afterOwnTurns(digIn(garrisoned(), "delta"), "red", 2);
    const after = attack(
      asPlayer(hardened, "red", "attack"),
      "delta",
      "charlie",
      fixedDice([1, 1, 1, 6, 6]),
    );
    expect(holding(after.state, "delta").line).toBeNull();
  });

  it("is gone when the territory changes hands", () => {
    const strongNeighbour = garrisoned({
      armies: { alfa: 2, bravo: 2, charlie: 9, delta: 5, echo: 1 },
    });
    const hardened = afterOwnTurns(digIn(strongNeighbour, "delta"), "red", 2);

    let state = asPlayer(hardened, "blue", "attack");
    for (let exchange = 0; exchange < 10; exchange += 1) {
      if (holding(state, "delta").owner === "blue") break;
      state = attack(state, "charlie", "delta", fixedDice([6, 6, 6, 1, 1, 1])).state;
    }

    expect(holding(state, "delta").owner).toBe("blue");
    expect(holding(state, "delta").line).toBeNull();
  });
});
