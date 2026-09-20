import { createMapView } from "../render/mapView";
import { describeOutcome, presentGame } from "./presentation";
import { drawDie } from "../render/dice";
import type { BattleShown } from "./presentation";
import { attack, deploy, digIn, endPhase, fortify, IllegalMoveError } from "../domain/turn";
import { holdingOf } from "../domain/game";
import type { Dice } from "../domain/dice";
import type { GameState, PlayerId } from "../domain/game";
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
  let lastBattle: BattleShown | undefined;
  /** Set while the phone is between players, so no one reads the other's board. */
  let awaiting: PlayerId | null = null;

  const view = createMapView(state.map);

  const map = document.createElement("div");
  map.className = "board__map";
  map.append(view.element);

  const status = document.createElement("p");
  status.className = "board__status";
  status.setAttribute("data-role", "status");
  status.setAttribute("role", "status");

  const battleLine = document.createElement("p");
  battleLine.className = "board__battle";
  battleLine.setAttribute("data-role", "battle");
  battleLine.setAttribute("role", "status");

  const endControl = document.createElement("button");
  endControl.className = "board__end";
  endControl.type = "button";
  endControl.setAttribute("data-role", "end-phase");

  const handover = document.createElement("button");
  handover.className = "board__handover";
  handover.type = "button";
  handover.setAttribute("data-role", "handover");
  handover.hidden = true;

  host.append(map, handover, battleLine, status, endControl);

  const render = (): void => {
    const passing = awaiting !== null;

    map.hidden = passing;
    endControl.hidden = passing;
    handover.hidden = !passing;
    battleLine.hidden = passing || lastBattle === undefined;

    if (passing) {
      handover.textContent = `${awaiting}: tap to start your turn`;
      status.textContent = "Pass the phone on. The board is hidden until it is taken up again.";
      return;
    }

    const shown = presentGame(state, selected, note);
    view.show(shown.territories);
    status.textContent = shown.status;
    showBattle(battleLine, lastBattle);
    endControl.textContent = shown.endPhaseLabel;
    endControl.disabled = !shown.canEndPhase;
  };

  const nameOf = (territory: TerritoryId): string =>
    state.map.territories.find((candidate) => candidate.id === territory)?.name ?? territory;

  /**
   * Runs a move and says what came of it. A move that the rules reject leaves
   * the board alone and reports why; a move that succeeds says so, because a
   * change the player cannot see is a change they will not believe happened.
   */
  const tryMove = (move: () => string | void): void => {
    note = undefined;
    try {
      note = move() ?? undefined;
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
          const defender = holdingOf(state, tapped).owner;
          const result = attack(state, from, tapped, dice);
          state = result.state;
          lastBattle = {
            attacker: state.currentPlayer,
            defender,
            attackerDice: result.battle.attackerDice,
            defenderDice: result.battle.defenderDice,
            attackerLosses: result.battle.attackerLosses,
            defenderLosses: result.battle.defenderLosses,
            conquered: result.conquered,
          };
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
            return `${nameOf(from)} is digging in. It holds from the end of your next turn.`;
          }
          /*
           * PROVISIONAL: a fortify moves everything that can leave, keeping one
           * army behind, rather than asking how many. It is one gesture instead
           * of a slider, at the cost of the finer choice.
           */
          const moved = holdingOf(state, from).armies - 1;
          state = fortify(state, from, tapped, moved);
          return `${moved === 1 ? "1 army" : `${moved} armies`} moved from ${nameOf(from)} to ${nameOf(tapped)}.`;
        });
        return;
    }
  });

  endControl.addEventListener("click", () => {
    selected = null;
    const before = state.currentPlayer;
    tryMove(() => {
      state = endPhase(state);
    });
    if (state.currentPlayer !== before && state.winner === null) {
      awaiting = state.currentPlayer;
      lastBattle = undefined;
      note = undefined;
      render();
    }
  });

  handover.addEventListener("click", () => {
    awaiting = null;
    render();
  });

  render();

  return { state: () => state };
}

/** Rebuilds the line of dice under the map from the last exchange. */
function showBattle(into: HTMLElement, battle: BattleShown | undefined): void {
  into.replaceChildren();
  if (battle === undefined) return;

  const side = (name: string, dice: readonly number[]): DocumentFragment => {
    const part = document.createDocumentFragment();
    const label = document.createElement("span");
    label.className = "board__side";
    label.textContent = name;
    part.append(label);
    for (const value of dice) part.append(drawDie(value));
    return part;
  };

  const versus = document.createElement("span");
  versus.className = "board__versus";
  versus.textContent = "vs";

  const outcome = document.createElement("span");
  outcome.className = "board__outcome";
  outcome.textContent = describeOutcome(battle);

  into.append(
    side(battle.attacker, battle.attackerDice),
    versus,
    side(battle.defender, battle.defenderDice),
    outcome,
  );
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
