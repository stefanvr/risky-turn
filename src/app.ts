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
 * `?seat=` opens the page as one player's own screen rather than as the shared
 * device, which is how a seat watching someone else's turn can be looked at
 * before there is a network to reach one over. Development only: the constant
 * folds away in a production build and takes the branch with it.
 */
const seat = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("seat") : null;

if (seat !== null) {
  const { openMatch } = await import("./match/match");
  const { loopback } = await import("./match/loopback");
  const { mountSeat } = await import("./ui/seat");
  mountSeat(host, openMatch({ state, dice, transport: loopback() }).seat(seat));
} else {
  mountGame(host, state, dice);
}
