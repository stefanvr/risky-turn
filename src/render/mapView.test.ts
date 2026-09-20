import { describe, expect, it } from "vitest";
import { createMapView } from "./mapView";
import { provingMap } from "../maps/proving";
import type { TerritoryPresentation } from "../ui/presentation";

const SVG_NS = "http://www.w3.org/2000/svg";

function regions(root: SVGSVGElement): SVGElement[] {
  return [...root.querySelectorAll<SVGElement>("[data-territory]")];
}

function board(
  overrides: Readonly<Record<string, Partial<TerritoryPresentation>>> = {},
): TerritoryPresentation[] {
  return provingMap.territories.map((territory) => ({
    id: territory.id,
    name: territory.name,
    owner: "red",
    playerNumber: 1,
    armies: 1,
    selected: false,
    line: "none" as const,
    ...overrides[territory.id],
  }));
}

describe("map view", () => {
  it("draws exactly one region per territory", () => {
    const view = createMapView(provingMap);
    expect(regions(view.element)).toHaveLength(provingMap.territories.length);
  });

  it("labels each region with the territory it stands for", () => {
    const view = createMapView(provingMap);
    const drawn = regions(view.element).map((region) => region.dataset["territory"]);
    expect(drawn.toSorted()).toEqual(
      provingMap.territories.map((territory) => territory.id).toSorted(),
    );
  });

  it("draws the map into an svg sized by the map's own view box", () => {
    const view = createMapView(provingMap);
    expect(view.element.namespaceURI).toBe(SVG_NS);
    expect(view.element.getAttribute("viewBox")).toBe(
      `0 0 ${provingMap.width} ${provingMap.height}`,
    );
  });

  it("shows each territory's army count", () => {
    const view = createMapView(provingMap);
    view.show(board({ charlie: { armies: 7 } }));
    expect(view.element.querySelector('[data-armies="charlie"]')?.textContent).toBe("7");
  });

  it("marks each region with the number of the player holding it", () => {
    const view = createMapView(provingMap);
    view.show(board({ echo: { playerNumber: 3 } }));
    const echo = view.element.querySelector('[data-territory="echo"]');
    expect(echo?.getAttribute("data-player")).toBe("3");
  });

  it("marks only the selected region as selected", () => {
    const view = createMapView(provingMap);

    view.show(board({ alfa: { selected: true } }));
    expect(selectedIds(view.element)).toEqual(["alfa"]);

    view.show(board({ bravo: { selected: true } }));
    expect(selectedIds(view.element)).toEqual(["bravo"]);

    view.show(board());
    expect(selectedIds(view.element)).toEqual([]);
  });

  it("shows where a line is being built and where one holds", () => {
    const view = createMapView(provingMap);
    view.show(board({ alfa: { line: "building" }, bravo: { line: "holding" } }));
    const lineOf = (id: string) =>
      view.element.querySelector(`[data-line-for="${id}"]`)?.getAttribute("data-line");
    expect(lineOf("alfa")).toBe("building");
    expect(lineOf("bravo")).toBe("holding");
    expect(lineOf("charlie")).toBe("none");
  });

  it("describes a region for a screen reader as its holder and strength", () => {
    const view = createMapView(provingMap);
    view.show(board({ delta: { owner: "blue", armies: 1 } }));
    const delta = view.element.querySelector('[data-territory="delta"]');
    expect(delta?.getAttribute("aria-label")).toBe("Delta, held by blue, 1 army");
  });
});

function selectedIds(root: SVGSVGElement): string[] {
  return regions(root)
    .filter((region) => region.getAttribute("aria-pressed") === "true")
    .map((region) => region.dataset["territory"]!);
}
