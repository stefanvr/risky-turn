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

describe("digging in", () => {
  const readyToFortify = (armies: Record<string, number>) =>
    stateWhere(board, { phase: "fortify", armies });

  it("digs in when a garrisoned territory is tapped twice", () => {
    mountGame(host, readyToFortify({ alfa: 6, bravo: 1, charlie: 1, delta: 1, echo: 1 }), fixedDice([1]));
    tap("alfa");
    tap("alfa");
    expect(host.querySelector('[data-line-for="alfa"]')?.getAttribute("data-line")).toBe("building");
  });

  it("says so when a territory starts digging in", () => {
    mountGame(host, readyToFortify({ alfa: 6, bravo: 1, charlie: 1, delta: 1, echo: 1 }), fixedDice([1]));
    tap("alfa");
    tap("alfa");
    expect(status()).toMatch(/alfa/i);
    expect(status()).toMatch(/digging in/i);
    expect(status()).not.toMatch(/fortify once/i);
  });

  it("says why a thin garrison cannot dig in", () => {
    mountGame(host, readyToFortify({ alfa: 3, bravo: 1, charlie: 1, delta: 1, echo: 1 }), fixedDice([1]));
    tap("alfa");
    tap("alfa");
    expect(status()).toMatch(/5 armies/i);
    expect(host.querySelector('[data-line-for="alfa"]')?.getAttribute("data-line")).toBe("none");
  });

  it("offers the choice once a garrisoned territory is selected", () => {
    mountGame(host, readyToFortify({ alfa: 6, bravo: 1, charlie: 1, delta: 1, echo: 1 }), fixedDice([1]));
    tap("alfa");
    expect(status()).toMatch(/dig in/i);
  });
});

describe("passing the phone", () => {
  const handoverButton = () =>
    host.querySelector<HTMLButtonElement>('[data-role="handover"]')!;
  const mapHidden = () => host.querySelector<HTMLElement>(".board__map")!.hidden;

  it("covers the board when a turn ends", () => {
    mountGame(host, stateWhere(board, { phase: "fortify" }), fixedDice([1]));
    endPhaseButton().click();
    expect(handoverButton().hidden).toBe(false);
    expect(mapHidden()).toBe(true);
    expect(handoverButton().textContent).toMatch(/blue/i);
  });

  it("uncovers it when the next player takes it up", () => {
    mountGame(host, stateWhere(board, { phase: "fortify" }), fixedDice([1]));
    endPhaseButton().click();
    handoverButton().click();
    expect(handoverButton().hidden).toBe(true);
    expect(mapHidden()).toBe(false);
    expect(status()).toMatch(/blue/i);
  });

  it("does not cover the board merely because a phase ended", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 0 }), fixedDice([1]));
    endPhaseButton().click();
    expect(handoverButton().hidden).toBe(true);
    expect(mapHidden()).toBe(false);
  });

  it("does not ask for a handover once the game is won", () => {
    const won = stateWhere(
      { alfa: "red", bravo: "red", charlie: "red", delta: "red", echo: "red" },
      { phase: "fortify" },
    );
    mountGame(host, { ...won, winner: "red" }, fixedDice([1]));
    expect(handoverButton().hidden).toBe(true);
  });
});

describe("showing an exchange", () => {
  const battleLine = () => host.querySelector('[data-role="battle"]') as HTMLElement;

  it("shows both sides' dice and what each lost", () => {
    const ready = stateWhere(board, {
      phase: "attack",
      armies: { alfa: 4, bravo: 3, charlie: 3, delta: 2, echo: 1 },
    });
    mountGame(host, ready, fixedDice([6, 5, 4, 1, 1]));
    tap("alfa");
    tap("bravo");

    const faces = [...battleLine().querySelectorAll("[data-die]")].map(
      (die) => die.getAttribute("data-die"),
    );

    expect(battleLine().hidden).toBe(false);
    expect(battleLine().textContent).toMatch(/red/i);
    expect(battleLine().textContent).toMatch(/blue/i);
    expect(faces).toEqual(["6", "5", "4", "1", "1"]);
    expect(battleLine().textContent).toMatch(/lost 2 armies/i);
  });

  it("shows nothing before a shot is fired", () => {
    mountGame(host, stateWhere(board, { phase: "attack" }), fixedDice([1]));
    expect(battleLine().hidden).toBe(true);
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
    host.querySelector<HTMLButtonElement>('[data-role="handover"]')!.click();
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
