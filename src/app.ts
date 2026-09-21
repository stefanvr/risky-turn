import { mountGame } from "./ui/game";
import { chooseStartingState } from "./ui/startup";
import { diceFrom } from "./domain/dice";
import { seededRandom } from "./domain/random";
import { worldMap } from "./maps/world";
import "./styles.css";

const host = document.querySelector("#game");
if (!host) throw new Error("page is missing its game element");

const { state, seed } = chooseStartingState(window.location.search, {
  map: worldMap,
  players: ["Red", "Blue"],
  // Constant-folded away in a production build, which drops the fixtures with it.
  fixtures: import.meta.env.DEV
    ? (await import("./dev/fixtures")).fixtureNamed
    : undefined,
  now: () => Date.now(),
});

const dice = diceFrom(seededRandom(seed + 1));

/*
 * Development only: the constant folds away in a production build and takes
 * every branch below with it.
 *
 * `?seat=` opens the page as one player's own screen rather than as the shared
 * device. Adding `?room=` puts that screen on a match shared with the other
 * tabs naming the same room — `&host` on the tab that owns the game, nothing
 * on the tabs that join it. Until join codes exist, this is how two seats
 * reach one match. docs/development.md has the pair of URLs.
 */
const parameters = new URLSearchParams(window.location.search);
const development = import.meta.env.DEV ? parameters : undefined;

/*
 * `?seat=` opens the page as one player's own screen rather than through the
 * door, and `?fixture=` puts a staged position on the board without one. Both
 * are development routes: the constant folds away in a production build and
 * takes every branch that uses it with it. docs/development.md has the detail.
 */
const seat = development?.get("seat") ?? null;

if (seat !== null) {
  const { mountSeat } = await import("./ui/seat");
  const { openMatch, joinSeat } = await import("./match/match");
  const room = development!.get("room");

  if (room === null) {
    const { loopback } = await import("./match/loopback");
    mountSeat(host, openMatch({ state, dice, transport: loopback() }).seat(seat));
  } else {
    const { tabTransport } = await import("./match/tabs");
    const transport = tabTransport(room);
    mountSeat(
      host,
      development!.has("host")
        ? openMatch({ state, dice, transport }).seat(seat)
        : await joinSeat(transport, seat),
    );
  }
} else if (development?.get("fixture") != null) {
  mountGame(host, state, dice);
} else {
  const { mountFrontDoor } = await import("./ui/frontDoor");
  mountFrontDoor(host, {
    state,
    players: ["Red", "Blue"],
    dice,
    random: seededRandom(seed + 2),
  });
}
