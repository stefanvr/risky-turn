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

mountGame(host, state, diceFrom(seededRandom(seed + 1)));
