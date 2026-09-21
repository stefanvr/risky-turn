import { mountGame } from "./game";
import { mountSeat } from "./seat";
import { joinSeat, openMatch } from "../match/match";
import { connect } from "../net/firebase";
import { enterRoom, openRoom } from "../net/rooms";
import { relay } from "../net/relay";
import type { Link, LinkState } from "../net/relay";
import type { Dice } from "../domain/dice";
import type { GameState, PlayerId } from "../domain/game";
import type { Random } from "../domain/random";
import type { GameMap } from "../domain/map";

/**
 * How the online way reaches another browser. It is an option so that the
 * screens can be checked without a connection, and so that what carries a
 * match can be replaced without the door knowing.
 */
export interface OnlinePlay {
  host(code: string, map: GameMap): Promise<Link>;
  join(code: string, map: GameMap): Promise<Link>;
}

export const overTheInternet: OnlinePlay = {
  async host(code, map) {
    return relay(await openRoom(await connect(`host-${code}`), code), map);
  },
  async join(code, map) {
    return relay(await enterRoom(await connect(`guest-${code}`), code), map);
  },
};

export interface FrontDoorOptions {
  readonly state: GameState;
  readonly players: readonly PlayerId[];
  readonly dice: Dice;
  readonly random: Random;
  /** How long a joining seat knocks before it decides nobody is there. */
  readonly waitFor?: number;
  readonly online?: OnlinePlay;
}

/** Six digits: the shape everyone has typed before, on the keypad a thumb hits. */
const CODE_LENGTH = 6;

export function codeFrom(random: Random): string {
  let code = "";
  for (let digit = 0; digit < CODE_LENGTH; digit += 1) {
    code += String(Math.floor(random.next() * 10));
  }
  return code;
}

/**
 * The first screen that is not the board.
 *
 * The product has two ways to play, so a player has to be able to choose one.
 * It earns its place by costing a single tap: the online way arrives already
 * holding a code, and joining is the smaller path underneath it rather than a
 * second decision everyone has to make.
 */
export function mountFrontDoor(host: Element, options: FrontDoorOptions): void {
  const online = options.online ?? overTheInternet;
  const players = options.players;
  const hostPlayer = players[0]!;
  const guestPlayer = players[1] ?? hostPlayer;

  const show = (build: (into: HTMLElement) => void): void => {
    host.innerHTML = "";
    const screen = document.createElement("section");
    screen.className = "door";
    build(screen);
    host.append(screen);
  };

  const title = (text: string): HTMLElement => {
    const heading = document.createElement("h1");
    heading.className = "door__title";
    heading.textContent = text;
    return heading;
  };

  const button = (role: string, label: string, onPress: () => void): HTMLButtonElement => {
    const control = document.createElement("button");
    control.className = "door__choice";
    control.type = "button";
    control.setAttribute("data-role", role);
    control.textContent = label;
    control.addEventListener("click", onPress);
    return control;
  };

  const quiet = (role: string, label: string, onPress: () => void): HTMLButtonElement => {
    const control = button(role, label, onPress);
    control.className = "door__aside";
    return control;
  };

  const says = (role: string, text: string): HTMLElement => {
    const line = document.createElement("p");
    line.className = "door__status";
    line.setAttribute("data-role", role);
    line.setAttribute("role", "status");
    line.textContent = text;
    return line;
  };

  const board = (mount: (into: Element) => void): void => {
    host.innerHTML = "";
    mount(host);
  };

  /**
   * The board, with a line above it saying whether the other player is still
   * there. A dropped connection is not something to discover by tapping.
   */
  const boardOnALink = (
    mount: (into: Element) => void,
    watch: (listener: (state: LinkState) => void) => void,
  ): void => {
    host.innerHTML = "";
    const line = says("link-state", "Connected.");
    line.className = "board__link";
    host.append(line);
    watch((state) => {
      line.textContent = state === "connected" ? "Connected." : "Connection lost.";
      line.setAttribute("data-link", state);
    });
    mount(host);
  };

  const chooseAWay = (): void =>
    show((screen) => {
      screen.append(
        title("Risky Turn"),
        button("pass-the-phone", "Pass the phone", () =>
          board((into) => {
            mountGame(into, options.state, options.dice);
          }),
        ),
        button("play-online", "Play online", waitOnACode),
      );
    });

  function waitOnACode(): void {
    const code = codeFrom(options.random);

    show((screen) => {
      const shown = document.createElement("p");
      shown.className = "door__code";
      shown.setAttribute("data-role", "join-code");
      shown.textContent = code;

      screen.append(
        title("Your code"),
        shown,
        says("door-status", "Read it to the other player. Waiting for them to join."),
        quiet("join-instead", "Join a game instead", typeACode),
      );
    });

    void (async () => {
      const joined = await online.host(code, options.state.map);
      const match = openMatch({
        state: options.state,
        dice: options.dice,
        transport: joined.transport,
        onJoin: () =>
          boardOnALink(
            (into) => mountSeat(into, match.seat(hostPlayer)),
            joined.onStateChange,
          ),
      });
    })().catch(() => {
      const status = host.querySelector('[data-role="door-status"]');
      if (status) status.textContent = "Could not reach the game service. Try again.";
    });
  }

  function typeACode(): void {
    show((screen) => {
      const field = document.createElement("input");
      field.className = "door__field";
      field.setAttribute("data-role", "code-field");
      field.inputMode = "numeric";
      field.autocomplete = "off";
      field.maxLength = CODE_LENGTH;
      field.setAttribute("aria-label", "The code the other player read out");

      const status = says("door-status", "Type the code the other player gives you.");

      screen.append(
        title("Their code"),
        field,
        button("join", "Join", () => {
          const code = field.value.trim();
          status.textContent = "Looking for that game\u2026";
          void (async () => {
            const joined = await online.join(code, options.state.map);
            const seat = await joinSeat(joined.transport, guestPlayer, options.waitFor);
            boardOnALink((into) => mountSeat(into, seat), joined.onStateChange);
          })().catch(() => {
            status.textContent = "No game is waiting on that code. Check it and try again.";
          });
        }),
        status,
        quiet("start-instead", "Start a game instead", waitOnACode),
      );
    });
  }

  chooseAWay();
}
