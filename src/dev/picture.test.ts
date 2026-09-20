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
 * the size a phone shows it. Set `PICTURE_TO` to a path to take one,
 * `PICTURE_CHOOSE` to a territory to choose it first, and `PICTURE_ARM` to
 * choose one and arm its squadron.
 *
 *   PICTURE_TO=/tmp/board.svg PICTURE_ARM=cairn pnpm vitest run src/dev/picture.test.ts
 *   python3 scripts/board-picture.py /tmp/board.svg /tmp/board.png
 */
describe("a picture of the board", () => {
  it("is taken on request, and otherwise only proves the board can be drawn", () => {
    const arm = process.env["PICTURE_ARM"] as TerritoryId | undefined;
    const choose = (arm ?? process.env["PICTURE_CHOOSE"]) as TerritoryId | undefined;
    const dealt = newGame(worldMap, ["Red", "Blue"], seededRandom(7));
    let state: GameState = { ...dealt, phase: "attack" };
    if (choose !== undefined) {
      state = withHolding(state, choose, {
        ...state.holdings.get(choose)!,
        owner: state.currentPlayer,
        armies: 6,
        bombers: arm === undefined ? 0 : 3,
      });
    }

    const host = document.createElement("div");
    document.body.append(host);
    mountGame(host, state, fixedDice([6, 6, 6]));

    if (choose !== undefined) {
      const region = host.querySelector(`[data-territory="${choose}"]`)!;
      region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      // A second tap on the chosen cell arms its squadron.
      if (arm !== undefined) region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }

    const drawn = host.querySelector("svg");
    expect(drawn).not.toBeNull();

    const to = process.env["PICTURE_TO"];
    if (to !== undefined) writeFileSync(to, drawn!.outerHTML);
  });
});
