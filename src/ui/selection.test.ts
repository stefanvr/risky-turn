import { describe, expect, it } from "vitest";
import { nextSelection } from "./selection";

describe("territory selection", () => {
  it("selects a territory when nothing is selected", () => {
    expect(nextSelection(null, "alfa")).toBe("alfa");
  });

  it("replaces the selection when another territory is tapped", () => {
    expect(nextSelection("alfa", "bravo")).toBe("bravo");
  });

  it("clears the selection when the selected territory is tapped again", () => {
    expect(nextSelection("alfa", "alfa")).toBeNull();
  });
});
