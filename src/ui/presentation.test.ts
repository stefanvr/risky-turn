import { describe, expect, it } from "vitest";
import { presentGame } from "./presentation";
import { stateWhere } from "../domain/testGames";

const board = { alfa: "red", bravo: "blue", charlie: "blue", delta: "red", echo: "red" } as const;

describe("what the board shows", () => {
  it("reports each territory's holder and army count", () => {
    const state = stateWhere(board, { armies: { alfa: 4 } });
    const alfa = presentGame(state, null).territories.find((t) => t.id === "alfa");
    expect(alfa).toMatchObject({ owner: "red", armies: 4, selected: false });
  });

  it("numbers players in turn order so each keeps one colour all game", () => {
    const state = stateWhere(board);
    const shown = presentGame(state, null).territories;
    expect(shown.find((t) => t.id === "alfa")?.playerNumber).toBe(1);
    expect(shown.find((t) => t.id === "bravo")?.playerNumber).toBe(2);
  });

  it("distinguishes a line being built from one that holds", () => {
    const state = stateWhere(board, {
      armies: { delta: 6, echo: 6 },
      lines: { delta: 1, echo: 0 },
    });
    const shown = presentGame(state, null).territories;
    expect(shown.find((t) => t.id === "delta")?.line).toBe("building");
    expect(shown.find((t) => t.id === "echo")?.line).toBe("holding");
    expect(shown.find((t) => t.id === "alfa")?.line).toBe("none");
  });

  it("keeps an opponent's line off the board until it is found", () => {
    const state = stateWhere(board, {
      armies: { bravo: 6 },
      lines: { bravo: 0 },
      currentPlayer: "red",
    });
    expect(presentGame(state, null).territories.find((t) => t.id === "bravo")?.line).toBe("none");
  });

  it("shows an opponent's line once an attack has found it", () => {
    const state = stateWhere(board, {
      armies: { bravo: 6 },
      lines: { bravo: { turns: 0, revealed: true } },
      currentPlayer: "red",
    });
    expect(presentGame(state, null).territories.find((t) => t.id === "bravo")?.line).toBe("holding");
  });

  it("marks the selected territory and only that one", () => {
    const state = stateWhere(board);
    const shown = presentGame(state, "delta").territories;
    expect(shown.filter((t) => t.selected).map((t) => t.id)).toEqual(["delta"]);
  });
});

describe("what the status line says", () => {
  it("names the player and the armies still to place while deploying", () => {
    const state = stateWhere(board, { reinforcementsLeft: 3 });
    expect(presentGame(state, null).status).toMatch(/red/i);
    expect(presentGame(state, null).status).toMatch(/3/);
  });

  it("names the phase being played", () => {
    expect(presentGame(stateWhere(board, { phase: "attack" }), null).status).toMatch(/attack/i);
    expect(presentGame(stateWhere(board, { phase: "fortify" }), null).status).toMatch(/fortif/i);
  });

  it("stops offering a fortify once the turn's fortify is spent", () => {
    const spent = stateWhere(board, { phase: "fortify", hasFortified: true });
    expect(presentGame(spent, null).status).not.toMatch(/fortify once/i);
    expect(presentGame(spent, null).status).toMatch(/end the turn/i);
  });

  it("announces the winner once the game is over", () => {
    const won = { ...stateWhere(board), winner: "red" };
    expect(presentGame(won, null).status).toMatch(/red/i);
    expect(presentGame(won, null).status).toMatch(/won|holds the map/i);
  });
});

describe("whether the phase may be ended", () => {
  it("refuses while reinforcements are still in hand", () => {
    expect(presentGame(stateWhere(board, { reinforcementsLeft: 2 }), null).canEndPhase).toBe(false);
  });

  it("allows it once they are placed", () => {
    expect(presentGame(stateWhere(board, { reinforcementsLeft: 0 }), null).canEndPhase).toBe(true);
  });

  it("refuses once the game is over", () => {
    const won = { ...stateWhere(board), winner: "red" };
    expect(presentGame(won, null).canEndPhase).toBe(false);
  });
});
