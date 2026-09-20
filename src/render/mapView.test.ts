import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createMapView } from "./mapView";
import { provingMap } from "../testing/provingMap";
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
    bombers: 0,
    selected: false,
    line: "none" as const,
    poised: null,
    reach: null,
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
    expect(countOf(view.element, "charlie", "armies").textContent).toBe("7");
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


  it("draws each force as its own icon with its count beside it", () => {
    const view = createMapView(provingMap);
    view.show(board({ delta: { armies: 4, bombers: 2 } }));

    expect(iconOf(view.element, "delta", "armies").getAttribute("data-force-icon")).toBe("tank");
    expect(countOf(view.element, "delta", "armies").textContent).toBe("4");
    expect(iconOf(view.element, "delta", "bombers").getAttribute("data-force-icon")).toBe("bomber");
    expect(countOf(view.element, "delta", "bombers").textContent).toBe("2");
  });

  it("stands the icons in one column and the counts in another", () => {
    const view = createMapView(provingMap);
    view.show(board({ delta: { armies: 4, bombers: 2 } }));

    const tank = placingOf(iconOf(view.element, "delta", "armies"));
    const bomber = placingOf(iconOf(view.element, "delta", "bombers"));
    const armyCount = countOf(view.element, "delta", "armies");
    const bomberCount = countOf(view.element, "delta", "bombers");

    expect(tank.x).toBe(bomber.x);
    expect(coordinate(armyCount, "x")).toBe(coordinate(bomberCount, "x"));
    // Bombers are the lower row, and each count sits on the centre line of the
    // icon it belongs to rather than near it.
    expect(bomber.y).toBeGreaterThan(tank.y);
    for (const [count, icon] of [[armyCount, tank], [bomberCount, bomber]] as const) {
      expect(coordinate(count, "y")).toBe(icon.y);
      expect(count.getAttribute("dominant-baseline")).toBe("central");
      expect(coordinate(count, "x")).toBeGreaterThan(icon.x);
    }
  });

  it("shows a squadron only where bombers stand", () => {
    const view = createMapView(provingMap);
    view.show(board({ delta: { bombers: 2 } }));
    const at = (id: string) => forceOf(view.element, id, "bombers");
    expect(at("delta").getAttribute("data-bombers")).toBe("2");
    expect(at("delta").style.display).toBe("");
    expect(at("alfa").style.display).toBe("none");
  });

  it("draws the water a bomber can cross and an army cannot", () => {
    const view = createMapView(provingMap);
    expect(view.element.querySelectorAll("[data-sea-link]")).toHaveLength(1);
    expect(view.element.querySelector("[data-sea-link]")?.getAttribute("data-sea-link")).toBe("alfa~echo");
  });

  it("draws the selection after every cell, so no neighbour paints over it", () => {
    const view = createMapView(provingMap);
    const children = [...view.element.children];
    const lastCell = children.findLastIndex((child) => child.hasAttribute("data-territory"));
    const selections = children.findIndex((child) => child.classList.contains("map__selection"));
    expect(selections).toBeGreaterThan(lastCell);
  });

  it("clips each selection to the cell it marks, so it cannot bleed outwards", () => {
    const view = createMapView(provingMap);
    const mark = view.element.querySelector('[data-selected-for="charlie"]');
    const clip = mark?.getAttribute("clip-path")?.match(/^url\(#(.+)\)$/)?.[1];
    expect(clip).toBeTruthy();
    expect(view.element.querySelector(`clipPath#${clip}`)).not.toBeNull();
  });

  it("shows the mark on the selected cell and nowhere else", () => {
    const view = createMapView(provingMap);
    const shownFor = () =>
      [...view.element.querySelectorAll<SVGElement>("[data-selected-for]")]
        .filter((mark) => mark.style.display !== "none")
        .map((mark) => mark.getAttribute("data-selected-for"));

    view.show(board({ charlie: { selected: true } }));
    expect(shownFor()).toEqual(["charlie"]);

    view.show(board());
    expect(shownFor()).toEqual([]);
  });

  it("accents whichever force the cell would strike with", () => {
    const view = createMapView(provingMap);
    view.show(board({ alfa: { poised: "armies" }, bravo: { poised: "bombers", bombers: 2 } }));

    const armiesOf = (id: string) => forceOf(view.element, id, "armies").getAttribute("data-poised");
    const bombersOf = (id: string) => forceOf(view.element, id, "bombers").getAttribute("data-poised");

    // The mark is carried by the numbers themselves, so one cell being poised
    // cannot light up the others.
    expect(armiesOf("alfa")).toBe("armies");
    expect(bombersOf("alfa")).toBe("armies");
    expect(armiesOf("bravo")).toBe("bombers");
    expect(bombersOf("bravo")).toBe("bombers");
    expect(armiesOf("charlie")).toBe("none");
    expect(bombersOf("charlie")).toBe("none");
  });

  it("paints the water over the ground, not under it", () => {
    // SVG has no z-index: a sea link drawn before the regions is covered by
    // them and the player sees nothing at all.
    const view = createMapView(provingMap);
    const children = [...view.element.children];
    const lastRegion = children.findLastIndex((child) => child.hasAttribute("data-territory"));
    const water = children.findIndex((child) => child.classList.contains("map__sea"));
    expect(water).toBeGreaterThan(lastRegion);
  });

  it("describes a region for a screen reader as its holder and strength", () => {
    const view = createMapView(provingMap);
    view.show(board({ delta: { owner: "blue", armies: 1, bombers: 2 } }));
    const delta = view.element.querySelector('[data-territory="delta"]');
    expect(delta?.getAttribute("aria-label")).toBe("Delta, held by blue, 1 army, 2 bombers");
  });
});

function selectedIds(root: SVGSVGElement): string[] {
  return regions(root)
    .filter((region) => region.getAttribute("aria-pressed") === "true")
    .map((region) => region.dataset["territory"]!);
}

function forceOf(root: SVGSVGElement, id: string, force: "armies" | "bombers"): SVGElement {
  const group = root.querySelector<SVGElement>(`[data-${force}-for="${id}"]`);
  if (!group) throw new Error(`no ${force} drawn for ${id}`);
  return group;
}

function iconOf(root: SVGSVGElement, id: string, force: "armies" | "bombers"): SVGElement {
  return forceOf(root, id, force).querySelector<SVGElement>(".force__icon")!;
}

function countOf(root: SVGSVGElement, id: string, force: "armies" | "bombers"): SVGElement {
  return forceOf(root, id, force).querySelector<SVGElement>(".force__count")!;
}

/** Where a glyph is placed. It is drawn about its own centre, so this is it. */
function placingOf(icon: SVGElement): { x: number; y: number } {
  const placed = icon.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
  if (!placed) throw new Error(`glyph is not placed: ${icon.getAttribute("transform")}`);
  return { x: Number(placed[1]), y: Number(placed[2]) };
}

function coordinate(element: SVGElement, name: string): number {
  return Number(element.getAttribute(name));
}

describe("continents on the board", () => {
  it("draws a coast for each continent, above the ground it encloses", () => {
    const view = createMapView(provingMap);
    const drawn = [...view.element.querySelectorAll("[data-coast-for]")];
    expect(drawn.map((path) => path.getAttribute("data-coast-for")).toSorted()).toEqual(
      provingMap.continents.map((continent) => continent.id).toSorted(),
    );
    const regions = [...view.element.querySelectorAll("[data-territory]")];
    const order = [...view.element.querySelectorAll("*")];
    expect(order.indexOf(drawn[0]!)).toBeGreaterThan(order.indexOf(regions.at(-1)!));
  });

  it("closes every loop it draws", () => {
    const view = createMapView(provingMap);
    for (const path of view.element.querySelectorAll("[data-coast-for]")) {
      expect(path.getAttribute("d")).toMatch(/Z$/);
    }
  });

  it("marks a continent's coast apart from a territory's own border", () => {
    const stylesheet = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");
    expect(stylesheet).toMatch(/\.continent__coast\s*\{[^}]+\}/);
  });
});
