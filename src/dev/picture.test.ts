import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mountGame } from "../ui/game";
import { newGame } from "../domain/setup";
import { seededRandom } from "../domain/random";
import { withHolding } from "../domain/game";
import { fixedDice } from "../domain/dice";
import { worldMap } from "../maps/world";
import type { TerritoryId } from "../domain/map";
import type { GameState } from "../domain/game";

/**
 * Takes a picture of the board for looking at, rather than for asserting on.
 *
 * jsdom performs no layout and no painting, so the only way to see what a
 * change actually looks like without a browser is to write out the SVG the
 * renderer produced and raster it: `scripts/board-picture.py` does that at
 * the size a phone shows it. Set `PICTURE_TO` to a path to take one, and
 * `PICTURE_ARM` to a territory to arm its squadron first.
 *
 *   PICTURE_TO=/tmp/board.svg PICTURE_ARM=cairn pnpm vitest run src/dev/picture.test.ts
 *   python3 scripts/board-picture.py /tmp/board.svg /tmp/board.png
 */
describe("a picture of the board", () => {
  it("is taken on request, and otherwise only proves the board can be drawn", () => {
    const arm = process.env["PICTURE_ARM"] as TerritoryId | undefined;
    const dealt = newGame(worldMap, ["Red", "Blue"], seededRandom(7));
    let state: GameState = { ...dealt, phase: "attack" };
    if (arm !== undefined) {
      state = withHolding(state, arm, {
        ...state.holdings.get(arm)!,
        owner: state.currentPlayer,
        armies: 6,
        bombers: 3,
      });
    }

    const host = document.createElement("div");
    document.body.append(host);
    mountGame(host, state, fixedDice([6, 6, 6]));

    if (arm !== undefined) {
      const region = host.querySelector(`[data-territory="${arm}"]`)!;
      // Once to choose the cell, again to arm its squadron.
      region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }

    const drawn = host.querySelector("svg");
    expect(drawn).not.toBeNull();

    const to = process.env["PICTURE_TO"];
    if (to !== undefined) writeFileSync(to, drawn!.outerHTML);
  });
});
