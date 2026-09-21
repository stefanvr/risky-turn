import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountFrontDoor } from "./frontDoor";
import { seededRandom } from "../domain/random";
import { worldMap } from "../maps/world";
import { newGame } from "../domain/setup";
import { seededDice } from "../domain/dice";

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});

function openTheDoor(): void {
  mountFrontDoor(host, {
    state: newGame(worldMap, ["Red", "Blue"], seededRandom(7)),
    players: ["Red", "Blue"],
    dice: seededDice(7),
    random: seededRandom(7),
    waitFor: 50,
    online: {
      // The screens are what is under test here; reaching another browser is
      // checked across two real ones in src/dev/online.test.ts.
      host: () => new Promise(() => undefined),
      join: () => Promise.reject(new Error("no game is waiting on that code")),
    },
  });
}

const control = (role: string): HTMLButtonElement | null =>
  host.querySelector<HTMLButtonElement>(`[data-role="${role}"]`);

const tap = (role: string): void => {
  const button = control(role);
  if (!button) throw new Error(`no control for ${role}`);
  button.click();
};

/**
 * The first screen this game has that is not the board. It exists because the
 * product has two ways to play and a player has to be able to choose one; it
 * earns its place by costing a single tap and then getting out of the way.
 */
describe("the front door", () => {
  it("offers both ways to play", () => {
    openTheDoor();
    expect(control("pass-the-phone")).not.toBeNull();
    expect(control("play-online")).not.toBeNull();
  });

  it("gives the shared-device game straight away", () => {
    openTheDoor();
    tap("pass-the-phone");
    expect(host.querySelector('[data-role="turn"]')).not.toBeNull();
    expect(control("play-online")).toBeNull();
  });

  it("makes a six-digit code and waits on it", () => {
    openTheDoor();
    tap("play-online");

    const code = host.querySelector('[data-role="join-code"]')?.textContent ?? "";
    expect(code.replace(/\s/g, "")).toMatch(/^\d{6}$/);
    expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(/waiting/i);
    // The board is not dealt to a host with nobody to play.
    expect(host.querySelector('[data-role="turn"]')).toBeNull();
  });

  it("refuses a code no room answers, and says so", async () => {
    openTheDoor();
    tap("play-online");
    tap("join-instead");

    const field = host.querySelector<HTMLInputElement>('[data-role="code-field"]');
    if (!field) throw new Error("no field to type a code into");
    field.value = "000000";
    tap("join");

    await vi.waitFor(() => {
      expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(
        /no game|not found|nobody/i,
      );
    });
    expect(host.querySelector('[data-role="turn"]')).toBeNull();
  });
});
