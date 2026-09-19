import { beforeEach, describe, expect, it } from "vitest";
import { mountGame } from "./game";
import { fixedDice } from "../domain/dice";
import { stateWhere } from "../domain/testGames";

const board = { alfa: "red", bravo: "blue", charlie: "blue", delta: "red", echo: "red" } as const;

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});

function tap(territory: string): void {
  const region = host.querySelector<SVGElement>(`[data-territory="${territory}"]`);
  if (!region) throw new Error(`no region drawn for ${territory}`);
  region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function armiesShown(territory: string): number {
  const label = host.querySelector(`[data-armies="${territory}"]`);
  return Number(label?.textContent);
}

function status(): string {
  return host.querySelector('[data-role="status"]')?.textContent ?? "";
}

function endPhaseButton(): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>('[data-role="end-phase"]');
  if (!button) throw new Error("no end-phase control");
  return button;
}

describe("showing the game", () => {
  it("puts each territory's army count on the map", () => {
    mountGame(host, stateWhere(board, { armies: { alfa: 4, bravo: 2 } }), fixedDice([1]));
    expect(armiesShown("alfa")).toBe(4);
    expect(armiesShown("bravo")).toBe(2);
  });

  it("marks each territory with the number of the player holding it", () => {
    mountGame(host, stateWhere(board), fixedDice([1]));
    expect(host.querySelector('[data-territory="alfa"]')?.getAttribute("data-player")).toBe("1");
    expect(host.querySelector('[data-territory="bravo"]')?.getAttribute("data-player")).toBe("2");
  });
});

describe("deploying by tapping", () => {
  it("places one army on a tapped territory the player holds", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 2, armies: { alfa: 1 } }), fixedDice([1]));
    tap("alfa");
    expect(armiesShown("alfa")).toBe(2);
    expect(status()).toMatch(/1/);
  });

  it("ignores a tap on a territory the player does not hold", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 2, armies: { bravo: 1 } }), fixedDice([1]));
    tap("bravo");
    expect(armiesShown("bravo")).toBe(1);
    expect(status()).toMatch(/does not hold/i);
  });

  it("does not show a count of nothing once every army is placed", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 1, armies: { alfa: 1 } }), fixedDice([1]));
    tap("alfa");
    tap("alfa");
    expect(status()).toMatch(/no reinforcements left/i);
    expect(status()).not.toMatch(/only 0/);
  });

  it("will not end the phase until every army is placed", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 1, armies: { alfa: 1 } }), fixedDice([1]));
    expect(endPhaseButton().disabled).toBe(true);
    tap("alfa");
    expect(endPhaseButton().disabled).toBe(false);
  });
});

describe("attacking by tapping", () => {
  const ready = () =>
    stateWhere(board, { phase: "attack", armies: { alfa: 4, bravo: 1, charlie: 3, delta: 2, echo: 1 } });

  it("takes the first tap as the territory attacking from", () => {
    mountGame(host, ready(), fixedDice([6, 5, 4, 1]));
    tap("alfa");
    expect(host.querySelector('[data-territory="alfa"]')?.getAttribute("aria-pressed")).toBe("true");
  });

  it("fights when a bordering enemy territory is tapped second", () => {
    mountGame(host, ready(), fixedDice([6, 5, 4, 1]));
    tap("alfa");
    tap("bravo");
    expect(host.querySelector('[data-territory="bravo"]')?.getAttribute("data-player")).toBe("1");
    expect(armiesShown("bravo")).toBe(3);
    expect(armiesShown("alfa")).toBe(1);
  });

  it("leaves the board alone and says why when the attack is not allowed", () => {
    mountGame(host, ready(), fixedDice([6, 5, 4, 1]));
    tap("delta");
    tap("bravo");
    expect(armiesShown("bravo")).toBe(1);
    expect(status()).toMatch(/border/i);
  });

  it("announces the winner when the last territory is taken", () => {
    const nearlyWon = stateWhere(
      { alfa: "red", bravo: "blue", charlie: "red", delta: "red", echo: "red" },
      { phase: "attack", armies: { alfa: 4, bravo: 1, charlie: 3, delta: 2, echo: 1 } },
    );
    mountGame(host, nearlyWon, fixedDice([6, 5, 4, 1]));
    tap("alfa");
    tap("bravo");
    expect(status()).toMatch(/red/i);
    expect(status()).toMatch(/won|holds the map/i);
  });
});

describe("moving through the turn", () => {
  it("runs deploy, attack, fortify, then hands over to the next player", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 0 }), fixedDice([1]));
    expect(status()).toMatch(/deploy|place/i);
    endPhaseButton().click();
    expect(status()).toMatch(/attack/i);
    endPhaseButton().click();
    expect(status()).toMatch(/fortif/i);
    endPhaseButton().click();
    expect(status()).toMatch(/blue/i);
  });

  it("stops accepting taps once the game is won", () => {
    const won = { ...stateWhere(board, { phase: "attack" }), winner: "red" };
    mountGame(host, won, fixedDice([1]));
    tap("alfa");
    expect(host.querySelector('[data-territory="alfa"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(endPhaseButton().disabled).toBe(true);
  });
});
