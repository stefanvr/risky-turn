import { mountGame } from "./ui/game";
import { newGame } from "./domain/setup";
import { diceFrom } from "./domain/dice";
import { seededRandom } from "./domain/random";
import { provingMap } from "./maps/proving";
import "./styles.css";

const host = document.querySelector("#game");
if (!host) throw new Error("page is missing its game element");

// The only place a seed is drawn from the clock: everything below it is
// reproducible from that number alone.
const random = seededRandom(Date.now());

mountGame(host, newGame(provingMap, ["Red", "Blue"], random), diceFrom(random));
