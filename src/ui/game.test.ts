import { readFileSync } from "node:fs";
import { join } from "node:path";
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
  const label = host.querySelector(`[data-armies-for="${territory}"] .force__count`);
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

  it("hands the phone over in the colour of the player taking it", () => {
    // Words alone are the one thing a player glancing at a passed phone can
    // miss; the panel carries the same colour their territories do.
    mountGame(host, stateWhere(board, { phase: "fortify" }), fixedDice([1]));
    endPhaseButton().click();
    expect(handoverButton().getAttribute("data-player")).toBe("2");
  });

  it("paints a handover for every player the map itself can paint", () => {
    const stylesheet = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    const numbers = (selector: string) =>
      [...stylesheet.matchAll(new RegExp(`\\${selector}\\[data-player="(\\d)"\\]`, "g"))]
        .map((match) => match[1])
        .toSorted();
    expect(numbers(".board__handover")).toEqual(numbers(".territory"));
    expect(numbers(".territory").length).toBeGreaterThan(1);
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

describe("bombers", () => {
  const buildButton = () => host.querySelector<HTMLButtonElement>('[data-role="build-bomber"]')!;
  const squadron = (id: string) =>
    host.querySelector(`[data-bombers-for="${id}"]`)?.getAttribute("data-bombers");

  it("offers a bomber only while there are reinforcements to spend", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 3 }), fixedDice([1]));
    expect(buildButton().hidden).toBe(false);
    expect(buildButton().disabled).toBe(false);
  });

  it("will not offer one that cannot be paid for", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 2 }), fixedDice([1]));
    expect(buildButton().disabled).toBe(true);
  });

  it("stations a bomber where the next tap lands", () => {
    mountGame(host, stateWhere(board, { reinforcementsLeft: 3 }), fixedDice([1]));
    buildButton().click();
    expect(status()).toMatch(/station a bomber/i);
    tap("alfa");
    expect(squadron("alfa")).toBe("1");
    expect(status()).toMatch(/bomber is stationed in alfa/i);
  });

  it("keeps the build control out of the way outside the deploy phase", () => {
    mountGame(host, stateWhere(board, { phase: "attack" }), fixedDice([1]));
    expect(buildButton().hidden).toBe(true);
  });

  it("sends a squadron when its territory is tapped twice in the attack phase", () => {
    const armed = stateWhere(board, {
      phase: "attack",
      armies: { alfa: 2, bravo: 4 },
      bombers: { alfa: 2 },
    });
    mountGame(host, armed, fixedDice([6, 5]));
    tap("alfa");
    tap("alfa");
    expect(status()).toMatch(/choose what to bomb/i);
    tap("bravo");
    expect(armiesShown("bravo")).toBe(2);
    expect(squadron("alfa")).toBe("2");
  });

  it("shows the run's dice and what it destroyed", () => {
    const armed = stateWhere(board, {
      phase: "attack",
      armies: { alfa: 2, bravo: 4 },
      bombers: { alfa: 2 },
    });
    mountGame(host, armed, fixedDice([6, 5]));
    tap("alfa");
    tap("alfa");
    tap("bravo");

    const line = host.querySelector('[data-role="battle"]') as HTMLElement;
    const faces = [...line.querySelectorAll("[data-die]")].map((d) => d.getAttribute("data-die"));
    expect(faces).toEqual(["6", "5"]);
    expect(line.textContent).toMatch(/bombs bravo/i);
    expect(line.textContent).toMatch(/2 armies destroyed/i);
  });

  it("says so when a territory has no bombers to send", () => {
    mountGame(host, stateWhere(board, { phase: "attack", armies: { alfa: 3 } }), fixedDice([1]));
    tap("alfa");
    tap("alfa");
    expect(status()).toMatch(/no bomber/i);
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

describe("arming a squadron", () => {
  const armed = { ...board, delta: "red", echo: "blue" } as const;

  function reachOf(territory: string): string {
    const region = host.querySelector<SVGElement>(`[data-territory="${territory}"]`);
    return region?.getAttribute("data-reach") ?? "none";
  }

  it("marks every region with whether the squadron can reach it", () => {
    mountGame(
      host,
      stateWhere(armed, { phase: "attack", armies: { alfa: 3 }, bombers: { alfa: 2 } }),
      fixedDice([6, 6]),
    );
    tap("alfa");
    tap("alfa");
    expect(reachOf("echo")).toBe("in");
    expect(reachOf("alfa")).toBe("in");
    expect(reachOf("bravo")).toBe("in");
  });

  it("paints what is out of reach differently from what is in it", () => {
    const stylesheet = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    expect(stylesheet).toMatch(/\.territory\[data-reach="out"\]\s*\{[^}]+\}/);
  });

  it("makes the board whole again once the run has flown", () => {
    mountGame(
      host,
      stateWhere(armed, { phase: "attack", armies: { alfa: 3, echo: 4 }, bombers: { alfa: 2 } }),
      fixedDice([6, 6]),
    );
    tap("alfa");
    tap("alfa");
    tap("echo");
    for (const territory of Object.keys(armed)) {
      expect(reachOf(territory), `${territory} stayed marked`).toBe("none");
    }
  });
});
