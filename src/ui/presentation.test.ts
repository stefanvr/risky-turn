import { describe, expect, it } from "vitest";
import { legendOf, presentGame } from "./presentation";
import { stateWhere } from "../domain/testGames";
import { worldMap } from "../maps/world";
import { newGame } from "../domain/setup";
import { seededRandom } from "../domain/random";
import { BOMBER_COST, LINE_MINIMUM_GARRISON, withHolding } from "../domain/game";
import { REINFORCEMENT_FLOOR, TERRITORIES_PER_ARMY } from "../domain/reinforcements";
import { provingMap } from "../testing/provingMap";
import { attack, bomb, IllegalMoveError } from "../domain/turn";
import { fixedDice } from "../domain/dice";
import type { GameState } from "../domain/game";

const board = { alfa: "red", bravo: "blue", charlie: "blue", delta: "red", echo: "red" } as const;

describe("the fortify phase's own control", () => {
  const garrisoned = { alfa: LINE_MINIMUM_GARRISON + 1, bravo: 1, charlie: 1, delta: 1, echo: 1 };
  const fortifying = (overrides = {}) =>
    stateWhere(board, { phase: "fortify", armies: garrisoned, ...overrides });

  it("names the territory it would dig in", () => {
    expect(presentGame(fortifying(), "alfa").digIn).toEqual({ label: "Dig in at Alfa" });
  });

  it("is absent until a territory is chosen", () => {
    expect(presentGame(fortifying(), null).digIn).toBeNull();
  });

  it("is absent where the rules would refuse the move", () => {
    const thin = stateWhere(board, { phase: "fortify", armies: { ...garrisoned, alfa: 3 } });
    expect(presentGame(thin, "alfa").digIn).toBeNull();
    expect(presentGame(fortifying({ hasFortified: true }), "alfa").digIn).toBeNull();
    expect(presentGame(stateWhere(board, { phase: "attack", armies: garrisoned }), "alfa").digIn)
      .toBeNull();
  });

  it("is absent on ground the player does not hold, and on ground already dug in", () => {
    expect(presentGame(fortifying(), "bravo").digIn).toBeNull();
    const dug = stateWhere(board, { phase: "fortify", armies: garrisoned, lines: { alfa: 2 } });
    expect(presentGame(dug, "alfa").digIn).toBeNull();
  });

  it("leaves the status line to say only what a tap does", () => {
    expect(presentGame(fortifying(), "alfa").status).not.toMatch(/again/i);
    expect(presentGame(fortifying(), "alfa").status).toMatch(/move its armies/i);
  });
});

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
  it("counts the armies still to place, and leaves whose turn it is to the turn bar", () => {
    const state = stateWhere(board, { reinforcementsLeft: 3 });
    expect(presentGame(state, null).status).toMatch(/3/);
    // The player's name is on screen permanently now; repeating it in the one
    // line that has to carry what just happened only spends room.
    expect(presentGame(state, null).status).not.toMatch(/red/i);
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
 * A lit cell is somewhere the poised force could strike now. The tests ask
 * the rules themselves rather than a restatement of them: a cell is lit if
 * and only if the move the tap would make is one `attack` or `bomb` allows.
 *
 * They run on the world rather than the proving ground, where every territory
 * lies within reach of every other and a veil would have nothing to say.
 */
describe("what a poised force shows", () => {
  const onTheWorld = (acting: string, bombers: number): GameState => {
    const dealt = newGame(worldMap, ["red", "blue"], seededRandom(7));
    const state = { ...dealt, phase: "attack" as const };
    return withHolding(state, acting, {
      ...state.holdings.get(acting)!,
      owner: state.currentPlayer,
      armies: 6,
      bombers,
    });
  };

  const allows = (move: () => unknown): boolean => {
    try {
      move();
      return true;
    } catch (error) {
      if (error instanceof IllegalMoveError) return false;
      throw error;
    }
  };

  it("lights exactly the ground a squadron may bomb, its own ground included in neither", () => {
    const state = onTheWorld("cairn", 3);
    const shown = presentGame(state, null, undefined, "cairn").territories;
    for (const territory of shown) {
      if (territory.id === "cairn") continue;
      const legal = allows(() => bomb(state, "cairn", territory.id, fixedDice([1])));
      expect(
        territory.reach === "in",
        `${territory.id} is lit: ${territory.reach === "in"}, but bombing it is ${legal}`,
      ).toBe(legal);
    }
  });

  it("lights exactly the ground an army may attack", () => {
    const state = onTheWorld("cairn", 0);
    const shown = presentGame(state, "cairn").territories;
    for (const territory of shown) {
      if (territory.id === "cairn") continue;
      const legal = allows(() => attack(state, "cairn", territory.id, fixedDice([1])));
      expect(
        territory.reach === "in",
        `${territory.id} is lit: ${territory.reach === "in"}, but attacking it is ${legal}`,
      ).toBe(legal);
    }
  });

  it("never veils the cell that is acting", () => {
    const armed = presentGame(onTheWorld("cairn", 3), null, undefined, "cairn").territories;
    expect(armed.find((t) => t.id === "cairn")?.reach).toBe("in");
    const chosen = presentGame(onTheWorld("cairn", 0), "cairn").territories;
    expect(chosen.find((t) => t.id === "cairn")?.reach).toBe("in");
  });

  it("marks the board both ways, or the veil would be saying nothing", () => {
    const shown = presentGame(onTheWorld("cairn", 3), null, undefined, "cairn").territories;
    expect(shown.filter((t) => t.reach === "in").length).toBeGreaterThan(1);
    expect(shown.filter((t) => t.reach === "out").length).toBeGreaterThan(1);
  });

  it("veils the whole board around a cell with nothing it may attack", () => {
    // Every neighbour of Cairn handed to its own holder: nothing to attack.
    let state = onTheWorld("cairn", 0);
    for (const neighbour of worldMap.territories.find((t) => t.id === "cairn")!.neighbours) {
      state = withHolding(state, neighbour, {
        ...state.holdings.get(neighbour)!,
        owner: state.currentPlayer,
      });
    }
    const shown = presentGame(state, "cairn").territories;
    expect(shown.filter((t) => t.reach === "in").map((t) => t.id)).toEqual(["cairn"]);
  });

  it("reaches across water a march could not, and stops short of ground two borders away", () => {
    // Dunmar is linked by sea to Verrick, and three land borders from Sable.
    const state = onTheWorld("dunmar", 3);
    const shown = presentGame(state, null, undefined, "dunmar").territories;
    const held = (id: string) => state.holdings.get(id)!.owner === state.currentPlayer;
    expect(shown.find((t) => t.id === "verrick")?.reach).toBe(held("verrick") ? "out" : "in");
    expect(shown.find((t) => t.id === "sable")?.reach).toBe("out");
  });

  it("veils nothing while nothing is chosen, or where there is nothing to strike", () => {
    const idle = presentGame(onTheWorld("cairn", 3), null).territories;
    expect(idle.map((t) => t.reach)).toEqual(idle.map(() => null));

    const fortifying = { ...onTheWorld("cairn", 0), phase: "fortify" as const };
    const moving = presentGame(fortifying, "cairn").territories;
    expect(moving.map((t) => t.reach)).toEqual(moving.map(() => null));
  });
});

describe("the legend", () => {
  const entries = () => legendOf(stateWhere(board)).flatMap((section) => section.entries);
  const about = (term: RegExp | string) => {
    const found = entries().find((entry) =>
      typeof term === "string" ? entry.term.includes(term) : term.test(entry.term),
    );
    if (!found) throw new Error(`the legend says nothing about ${term}`);
    return found;
  };

  it("takes a bomber's price from the rule that charges it", () => {
    expect(about(/bomber/i).detail).toContain(String(BOMBER_COST));
  });

  it("states what a turn earns, floor and all, from the rule that pays it", () => {
    const earned = about(/territor|cell/i).detail;
    expect(earned).toContain(String(TERRITORIES_PER_ARMY));
    expect(earned).toContain(String(REINFORCEMENT_FLOOR));
  });

  it("lists every continent on the board with the bonus that board gives it", () => {
    for (const continent of provingMap.continents) {
      expect(about(continent.name).detail).toContain(`+${continent.bonus}`);
    }
  });

  it("marks each continent with the number its coast is coloured by", () => {
    for (const [index, continent] of provingMap.continents.entries()) {
      expect(about(continent.name).coast).toBe(index + 1);
    }
  });

  it("states the garrison a defensive line needs", () => {
    expect(about(/line/i).detail).toContain(String(LINE_MINIMUM_GARRISON));
  });
});
