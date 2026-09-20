import { describe, expect, it } from "vitest";
import { drawDie } from "./dice";

const pips = (value: number) => drawDie(value).querySelectorAll(".die__pip").length;

describe("drawing a die", () => {
  it("shows one pip per point on the face", () => {
    for (const value of [1, 2, 3, 4, 5, 6]) {
      expect(pips(value)).toBe(value);
    }
  });

  it("says which face it is, for a reader that cannot see pips", () => {
    const die = drawDie(4);
    expect(die.getAttribute("data-die")).toBe("4");
    expect(die.getAttribute("aria-label")).toBe("4");
  });
});
