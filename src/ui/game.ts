import { createMapView } from "../render/mapView";
import { presentGame } from "./presentation";
import { attack, deploy, digIn, endPhase, fortify, IllegalMoveError } from "../domain/turn";
import { holdingOf } from "../domain/game";
import type { Dice } from "../domain/dice";
import type { GameState } from "../domain/game";
import type { TerritoryId } from "../domain/map";

export interface MountedGame {
  state(): GameState;
}

/**
 * Turns taps into moves. Every phase reads the same two gestures — tap a
 * territory, press the control — so nothing has to be explained twice on a
 * small screen. A move the rules reject changes nothing and says why.
 */
export function mountGame(host: Element, initial: GameState, dice: Dice): MountedGame {
  let state = initial;
  let selected: TerritoryId | null = null;
  let note: string | undefined;

  const view = createMapView(state.map);

  const map = document.createElement("div");
  map.className = "board__map";
  map.append(view.element);

  const status = document.createElement("p");
  status.className = "board__status";
  status.setAttribute("data-role", "status");
  status.setAttribute("role", "status");

  const endControl = document.createElement("button");
  endControl.className = "board__end";
  endControl.type = "button";
  endControl.setAttribute("data-role", "end-phase");

  host.append(map, status, endControl);

  const render = (): void => {
    const shown = presentGame(state, selected, note);
    view.show(shown.territories);
    status.textContent = shown.status;
    endControl.textContent = shown.endPhaseLabel;
    endControl.disabled = !shown.canEndPhase;
  };

  /** Runs a move, keeping the board unchanged and reporting why if it fails. */
  const tryMove = (move: () => void): void => {
    note = undefined;
    try {
      move();
    } catch (error) {
      if (!(error instanceof IllegalMoveError)) throw error;
      note = error.message;
      selected = null;
    }
    render();
  };

  view.onTap((tapped) => {
    if (state.winner !== null) return;

    switch (state.phase) {
      case "deploy":
        tryMove(() => {
          state = deploy(state, tapped, 1);
        });
        return;

      case "attack":
        if (selected === null) {
          tryMove(() => {
            selected = chooseSource(state, tapped, "attack from");
          });
          return;
        }
        tryMove(() => {
          const from = selected!;
          selected = null;
          state = attack(state, from, tapped, dice).state;
        });
        return;

      case "fortify":
        if (selected === null) {
          tryMove(() => {
            selected = chooseSource(state, tapped, "move armies from");
          });
          return;
        }
        tryMove(() => {
          const from = selected!;
          selected = null;
          if (from === tapped) {
            /*
             * PROVISIONAL: digging in is a second tap on the chosen territory
             * rather than its own control, which keeps one button on screen.
             * The status line offers it, so it is not left to be discovered.
             */
            state = digIn(state, from);
            return;
          }
          /*
           * PROVISIONAL: a fortify moves everything that can leave, keeping one
           * army behind, rather than asking how many. It is one gesture instead
           * of a slider, at the cost of the finer choice.
           */
          state = fortify(state, from, tapped, holdingOf(state, from).armies - 1);
        });
        return;
    }
  });

  endControl.addEventListener("click", () => {
    selected = null;
    tryMove(() => {
      state = endPhase(state);
    });
  });

  render();

  return { state: () => state };
}

/** The first tap of a two-tap move: it must be a territory that can act. */
function chooseSource(
  state: GameState,
  territory: TerritoryId,
  intent: string,
): TerritoryId {
  const holding = holdingOf(state, territory);
  if (holding.owner !== state.currentPlayer) {
    throw new IllegalMoveError(`${state.currentPlayer} does not hold ${territory}`);
  }
  if (holding.armies < 2) {
    throw new IllegalMoveError(`${territory} needs at least two armies to ${intent}`);
  }
  return territory;
}
