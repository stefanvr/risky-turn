import { describe, expect, it } from "vitest";
import { presentGame } from "./presentation";
import { stateWhere } from "../domain/testGames";
import { withinBomberReach } from "../domain/reach";
import { worldMap } from "../maps/world";
import { newGame } from "../domain/setup";
import { seededRandom } from "../domain/random";
import { withHolding } from "../domain/game";
import type { GameState } from "../domain/game";

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

  it("poises a selected cell on its armies while attacking", () => {
    const state = stateWhere(board, { phase: "attack", armies: { alfa: 3 } });
    const shown = presentGame(state, "alfa", undefined, null).territories;
    expect(shown.find((t) => t.id === "alfa")?.poised).toBe("armies");
    expect(shown.find((t) => t.id === "delta")?.poised).toBeNull();
  });

  it("poises an armed cell on its bombers instead", () => {
    const state = stateWhere(board, { phase: "attack", bombers: { alfa: 2 } });
    const shown = presentGame(state, null, undefined, "alfa").territories;
    expect(shown.find((t) => t.id === "alfa")?.poised).toBe("bombers");
  });

  it("keeps the outline on a cell whose squadron is armed", () => {
    const state = stateWhere(board, { phase: "attack", bombers: { alfa: 2 } });
    const shown = presentGame(state, null, undefined, "alfa").territories;
    expect(shown.filter((t) => t.selected).map((t) => t.id)).toEqual(["alfa"]);
  });

  it("poises nothing outside the attack phase", () => {
    const state = stateWhere(board, { phase: "fortify", armies: { alfa: 6 } });
    const shown = presentGame(state, "alfa", undefined, null).territories;
    expect(shown.find((t) => t.id === "alfa")?.poised).toBeNull();
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

/**
 * A bomber reaches two land borders or one sea link, and neither is drawn on
 * the board. While a squadron is armed, the cells it cannot strike are veiled,
 * so the range answers itself instead of having to be known.
 *
 * The discriminating tests run on the world rather than on the proving ground,
 * where every territory happens to lie within reach of every other and a veil
 * would have nothing to say.
 */
describe("what an armed squadron shows", () => {
  const onTheWorld = (squadron: string): GameState => {
    const dealt = newGame(worldMap, ["red", "blue"], seededRandom(7));
    const state = { ...dealt, phase: "attack" as const };
    return withHolding(state, squadron, {
      ...state.holdings.get(squadron)!,
      owner: state.currentPlayer,
      armies: 3,
      bombers: 2,
    });
  };

  it("veils nothing while no squadron is armed", () => {
    const shown = presentGame(onTheWorld("cairn"), "cairn").territories;
    expect(shown.map((t) => t.reach)).toEqual(shown.map(() => null));
  });

  it("veils exactly what the squadron cannot strike", () => {
    const state = onTheWorld("cairn");
    const shown = presentGame(state, null, undefined, "cairn").territories;
    for (const territory of shown) {
      if (territory.id === "cairn") continue;
      expect(
        territory.reach,
        `${territory.id} is marked "${territory.reach}" but reach says otherwise`,
      ).toBe(withinBomberReach(worldMap, "cairn", territory.id) ? "in" : "out");
    }
  });

  it("never veils the ground the squadron stands on", () => {
    const shown = presentGame(onTheWorld("cairn"), null, undefined, "cairn").territories;
    expect(shown.find((t) => t.id === "cairn")?.reach).toBe("in");
  });

  it("marks some of the board either way, or the veil would say nothing", () => {
    const shown = presentGame(onTheWorld("cairn"), null, undefined, "cairn").territories;
    expect(shown.filter((t) => t.reach === "in").length).toBeGreaterThan(1);
    expect(shown.filter((t) => t.reach === "out").length).toBeGreaterThan(1);
  });

  it("reaches across water a march could not, and stops short of ground two borders away", () => {
    // Dunmar is linked by sea to Verrick, and three land borders from Sable.
    const shown = presentGame(onTheWorld("dunmar"), null, undefined, "dunmar").territories;
    expect(shown.find((t) => t.id === "verrick")?.reach).toBe("in");
    expect(shown.find((t) => t.id === "sable")?.reach).toBe("out");
  });
});
