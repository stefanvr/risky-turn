import { beforeEach, describe, expect, it, vi } from "vitest";
import { mountFrontDoor } from "./frontDoor";
import { seededRandom } from "../domain/random";
import { worldMap } from "../maps/world";
import { newGame } from "../domain/setup";
import { seededDice } from "../domain/dice";
import { loopback } from "../match/loopback";
import type { OnlinePlay } from "./frontDoor";
import type { Link } from "../net/relay";

let host: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.append(host);
});

function openTheDoor(online?: Partial<OnlinePlay>): void {
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
      ...online,
    },
  });
}

/** A room that answers at once, carrying nothing. */
const aRoomThatAnswers = (): Promise<Link> =>
  Promise.resolve({
    transport: loopback(),
    state: () => "connected" as const,
    onStateChange: () => undefined,
  });

const field = (): HTMLInputElement => {
  const found = host.querySelector<HTMLInputElement>('[data-role="code-field"]');
  if (!found) throw new Error("no field to type a code into");
  return found;
};

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

  it("shows no code until there is a room that answers to it", () => {
    openTheDoor();
    tap("play-online");

    // Six digits on screen are a promise that they can be joined. Until the
    // room exists, the promise would be false — and a player would read it
    // out and be told there is no such game.
    expect(host.querySelector('[data-role="join-code"]')).toBeNull();
    expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(/getting|ready/i);
  });

  it("shows the six digits once the room answers, and waits on it", async () => {
    openTheDoor({ host: aRoomThatAnswers });
    tap("play-online");

    await vi.waitFor(() => {
      const code = host.querySelector('[data-role="join-code"]')?.textContent ?? "";
      expect(code.replace(/\s/g, "")).toMatch(/^\d{6}$/);
    });
    expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(/waiting/i);
    // The board is not dealt to a host with nobody to play.
    expect(host.querySelector('[data-role="turn"]')).toBeNull();
  });

  it("puts the cursor in the field, so the code can just be typed", () => {
    openTheDoor();
    tap("play-online");
    tap("join-instead");

    expect(document.activeElement).toBe(field());
  });

  it("joins on Enter, as though the button had been pressed", async () => {
    openTheDoor();
    tap("play-online");
    tap("join-instead");

    field().value = "000000";
    field().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));

    await vi.waitFor(() => {
      expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(
        /no game|not found|nobody/i,
      );
    });
  });

  it("refuses a code no room answers, and says so", async () => {
    openTheDoor();
    tap("play-online");
    tap("join-instead");

    field().value = "000000";
    tap("join");

    await vi.waitFor(() => {
      expect(host.querySelector('[data-role="door-status"]')?.textContent).toMatch(
        /no game|not found|nobody/i,
      );
    });
    expect(host.querySelector('[data-role="turn"]')).toBeNull();
  });
});
