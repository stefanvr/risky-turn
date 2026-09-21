import { createMapView } from "../render/mapView";
import {
  describeOutcome,
  describeRaid,
  legendOf,
  playerNumberOf,
  presentGame,
  turnOf,
} from "./presentation";
import { drawDie } from "../render/dice";
import type { BattleShown, RaidShown } from "./presentation";
import { attack, bomb, buildBomber, deploy, digIn, endPhase, fortify, IllegalMoveError } from "../domain/turn";
import { BOMBER_COST, holdingOf } from "../domain/game";
import type { Dice } from "../domain/dice";
import type { GameState, PlayerId } from "../domain/game";
import type { TerritoryId } from "../domain/map";

/** The last thing that happened worth putting under the map. */
type LastAction =
  | { readonly kind: "battle"; readonly battle: BattleShown }
  | { readonly kind: "raid"; readonly raid: RaidShown };

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
  let lastAction: LastAction | undefined;
  /** Set while the player has chosen to spend reinforcements on a bomber. */
  let buyingBomber = false;
  /** Set while a territory's bombers are chosen but their target is not. */
  let bombingFrom: TerritoryId | null = null;
  /** Set while the phone is between players, so no one reads the other's board. */
  let awaiting: PlayerId | null = null;
  /** Set while the legend is open over the board. */
  let reading = false;

  const view = createMapView(state.map);

  /*
   * Whose turn it is, what the turn still owes, and the way in to the legend.
   * It is the one thing on screen that never changes its subject, so nothing
   * that reports an event has to keep repeating what is permanently true.
   */
  const bar = document.createElement("header");
  bar.className = "board__turn";
  bar.setAttribute("data-role", "turn");

  const whose = document.createElement("span");
  whose.className = "board__whose";

  const doing = document.createElement("span");
  doing.className = "board__doing";

  const info = document.createElement("button");
  info.className = "board__info";
  info.type = "button";
  info.setAttribute("data-role", "legend-open");
  info.setAttribute("aria-expanded", "false");
  info.setAttribute("aria-label", "What things cost and what a turn earns");
  info.textContent = "i";

  bar.append(whose, doing, info);

  const legend = document.createElement("section");
  legend.className = "board__legend";
  legend.setAttribute("data-role", "legend");
  legend.hidden = true;

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

  const buildControl = document.createElement("button");
  buildControl.className = "board__act";
  buildControl.type = "button";
  buildControl.setAttribute("data-role", "build-bomber");
  buildControl.hidden = true;

  const digControl = document.createElement("button");
  digControl.className = "board__act";
  digControl.type = "button";
  digControl.setAttribute("data-role", "dig-in");
  digControl.hidden = true;

  // Each phase puts its own control here and no two share a moment, so one
  // berth serves them all. It stays for the whole turn whether it is filled or
  // not: a map that grows the moment the phase changes moves every target on
  // it under a thumb already reaching for one.
  const controlSlot = document.createElement("div");
  controlSlot.className = "board__berth";
  controlSlot.setAttribute("data-role", "control-slot");
  controlSlot.append(buildControl, digControl);

  const endControl = document.createElement("button");
  endControl.className = "board__end";
  endControl.type = "button";
  endControl.setAttribute("data-role", "end-phase");

  const handover = document.createElement("button");
  handover.className = "board__handover";
  handover.type = "button";
  handover.setAttribute("data-role", "handover");
  handover.hidden = true;

  host.append(bar, legend, map, handover, battleLine, status, controlSlot, endControl);
  fillLegend(legend, initial);

  const render = (): void => {
    const taking = awaiting;
    const passing = taking !== null;

    const turn = turnOf(state);
    whose.textContent = turn.player;
    whose.setAttribute("data-player", String(turn.playerNumber));
    doing.textContent = turn.doing;
    info.setAttribute("aria-expanded", String(reading));
    legend.hidden = passing || !reading;

    map.hidden = passing || reading;
    // The legend owns the screen while it is open: it is read, not played
    // against, and a sheet that has to be scrolled past the controls is one
    // whose last line is never found.
    endControl.hidden = passing || reading;
    status.hidden = reading;
    handover.hidden = !passing;
    battleLine.hidden = passing || reading || lastAction === undefined;
    // The berth leaves the screen only when the board itself does.
    controlSlot.hidden = passing || reading;
    buildControl.hidden = state.phase !== "deploy" || state.winner !== null;

    if (taking !== null) {
      handover.textContent = `${taking}: tap to start your turn`;
      // The bar already wears the incoming player's colour; the panel says the
      // same thing at the size of the screen, because this is the one moment
      // the wrong player picking the phone up cannot be undone.
      // The panel wears that player's own colour, so who is up is answered
      // before the sentence on it is read.
      handover.setAttribute("data-player", String(playerNumberOf(state, taking)));
      status.textContent = "Pass the phone on. The board is hidden until it is taken up again.";
      return;
    }

    const shown = presentGame(state, selected, note, bombingFrom);
    view.show(shown.territories);
    // While a bomber is being placed the line asks for the tap, unless the last
    // tap was refused: a move that did nothing has to say so, or the player is
    // left tapping ground that will never take it.
    status.textContent =
      buyingBomber && note === undefined
        ? "Tap one of your territories to station a bomber there."
        : shown.status;
    showAction(battleLine, lastAction);
    buildControl.textContent = buyingBomber
      ? "Choose where"
      : `Build a bomber (${BOMBER_COST})`;
    buildControl.disabled = state.reinforcementsLeft < BOMBER_COST;
    buildControl.setAttribute("aria-pressed", String(buyingBomber));
    // A control the rules would refuse is not offered at all, so the player
    // never spends the turn's only fortify on a tap they did not mean.
    digControl.hidden = shown.digIn === null;
    if (shown.digIn !== null) digControl.textContent = shown.digIn.label;
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
        if (buyingBomber) {
          tryMove(() => {
            state = buildBomber(state, tapped);
            buyingBomber = false;
            return `A bomber is stationed in ${nameOf(tapped)}.`;
          });
          return;
        }
        tryMove(() => {
          state = deploy(state, tapped, 1);
        });
        return;

      case "attack":
        // Bombers in the air are asked for their target before anything else,
        // or the tap that names it would be read as choosing a new source.
        if (bombingFrom !== null) {
          tryMove(() => {
            const from = bombingFrom!;
            bombingFrom = null;
            const run = bomb(state, from, tapped, dice);
            state = run.state;
            lastAction = {
              kind: "raid",
              raid: {
                attacker: state.currentPlayer,
                target: nameOf(tapped),
                dice: run.dice,
                kills: run.kills,
              },
            };
          });
          return;
        }
        if (selected === null) {
          tryMove(() => {
            selected = chooseSource(state, tapped, "attack from");
          });
          return;
        }
        if (selected === tapped) {
          // A second tap on the chosen territory sends its bombers instead of
          // its armies: the same idiom as digging in during a fortify.
          tryMove(() => {
            const base = holdingOf(state, tapped);
            if (base.bombers < 1) throw new IllegalMoveError(`${tapped} has no bomber to fly`);
            if (base.bombersFlown) {
              throw new IllegalMoveError(`the bombers at ${tapped} have already flown this turn`);
            }
            selected = null;
            bombingFrom = tapped;
            return `${nameOf(tapped)}: choose what to bomb.`;
          });
          return;
        }
        tryMove(() => {
          const from = selected!;
          selected = null;
          const defender = holdingOf(state, tapped).owner;
          const result = attack(state, from, tapped, dice);
          state = result.state;
          lastAction = {
            kind: "battle",
            battle: {
              attacker: state.currentPlayer,
              defender,
              attackerDice: result.battle.attackerDice,
              defenderDice: result.battle.defenderDice,
              attackerLosses: result.battle.attackerLosses,
              defenderLosses: result.battle.defenderLosses,
              conquered: result.conquered,
            },
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
          // The cell already chosen simply lets go. Digging in has its own
          // control now, so no tap of a territory can spend the turn's fortify.
          if (from === tapped) return;
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
      lastAction = undefined;
      note = undefined;
      buyingBomber = false;
      bombingFrom = null;
      // The phone goes over with nothing of the last turn left open on it.
      reading = false;
      render();
    }
  });

  info.addEventListener("click", () => {
    reading = !reading;
    render();
  });

  digControl.addEventListener("click", () => {
    const where = selected;
    if (where === null) return;
    selected = null;
    tryMove(() => {
      state = digIn(state, where);
      return `${nameOf(where)} is digging in. It holds from the end of your next turn.`;
    });
  });

  buildControl.addEventListener("click", () => {
    buyingBomber = !buyingBomber;
    selected = null;
    note = undefined;
    render();
  });

  handover.addEventListener("click", () => {
    awaiting = null;
    render();
  });

  render();

  return { state: () => state };
}

/**
 * The legend: what things cost, what a turn earns, and what each continent on
 * this board pays. It is drawn once, from the rules themselves, because none
 * of it changes while a game is played.
 */
function fillLegend(into: HTMLElement, state: GameState): void {
  for (const section of legendOf(state)) {
    const title = document.createElement("h2");
    title.className = "legend__title";
    title.textContent = section.title;
    into.append(title);

    const entries = document.createElement("dl");
    entries.className = "legend__entries";
    for (const entry of section.entries) {
      const row = document.createElement("div");
      row.className = "legend__entry";
      row.setAttribute("data-legend-entry", entry.term);

      const term = document.createElement("dt");
      term.className = "legend__term";
      if (entry.coast !== undefined) {
        // The colour the continent's own coast wears on the board, so the
        // sheet and the map answer the same question the same way.
        const swatch = document.createElement("span");
        swatch.className = "legend__swatch";
        swatch.setAttribute("data-coast", String(entry.coast));
        term.append(swatch);
      }
      term.append(entry.term);

      const detail = document.createElement("dd");
      detail.className = "legend__detail";
      detail.textContent = entry.detail;

      row.append(term, detail);
      entries.append(row);
    }
    into.append(entries);
  }
}

/** Rebuilds the line of dice under the map from the last thing that happened. */
function showAction(into: HTMLElement, action: LastAction | undefined): void {
  into.replaceChildren();
  if (action === undefined) return;
  if (action.kind === "raid") return showRaid(into, action.raid);

  const battle = action.battle;
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

/** A bombing run: one side, its dice, and what it destroyed. */
function showRaid(into: HTMLElement, raid: RaidShown): void {
  const label = document.createElement("span");
  label.className = "board__side";
  label.textContent = `${raid.attacker} bombs ${raid.target}`;
  into.append(label);

  for (const value of raid.dice) into.append(drawDie(value));

  const outcome = document.createElement("span");
  outcome.className = "board__outcome";
  outcome.textContent = describeRaid(raid);
  into.append(outcome);
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
