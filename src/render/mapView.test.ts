import { describe, expect, it } from "vitest";
import { createMapView } from "./mapView";
import { provingMap } from "../maps/proving";

const SVG_NS = "http://www.w3.org/2000/svg";

function regions(root: SVGSVGElement): SVGElement[] {
  return [...root.querySelectorAll<SVGElement>("[data-territory]")];
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

  it("marks only the selected region as selected", () => {
    const view = createMapView(provingMap);
    const [first, second] = provingMap.territories;

    view.showSelection(first!.id);
    expect(selectedIds(view.element)).toEqual([first!.id]);

    view.showSelection(second!.id);
    expect(selectedIds(view.element)).toEqual([second!.id]);

    view.showSelection(null);
    expect(selectedIds(view.element)).toEqual([]);
  });
});

function selectedIds(root: SVGSVGElement): string[] {
  return regions(root)
    .filter((region) => region.getAttribute("aria-pressed") === "true")
    .map((region) => region.dataset["territory"]!);
}
