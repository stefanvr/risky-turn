import { centreOf, validateMap } from "../domain/map";
import type { GameMap, Territory, TerritoryId } from "../domain/map";
import type { TerritoryPresentation } from "../ui/presentation";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface MapView {
  readonly element: SVGSVGElement;
  /** Draws what it is given. Decides nothing. */
  show(territories: readonly TerritoryPresentation[]): void;
  /** Reports the territory under a tap. */
  onTap(handler: (territory: TerritoryId) => void): void;
}

/**
 * Draws a map as SVG and reports taps on it. The view holds no game state, so
 * it can be replaced without touching the rules or the interaction on top of
 * them.
 */
export function createMapView(map: GameMap): MapView {
  validateMap(map);

  const element = document.createElementNS(SVG_NS, "svg");
  element.setAttribute("viewBox", `0 0 ${map.width} ${map.height}`);
  element.setAttribute("preserveAspectRatio", "xMidYMid meet");
  element.setAttribute("class", "map");
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", `${map.name} map`);

  const regions = new Map<TerritoryId, SVGElement>();
  const counts = new Map<TerritoryId, SVGElement>();
  const labels = document.createElementNS(SVG_NS, "g");
  labels.setAttribute("class", "map__labels");
  labels.setAttribute("aria-hidden", "true");

  for (const territory of map.territories) {
    const region = drawRegion(territory);
    regions.set(territory.id, region);
    element.append(region);

    const { group, count } = drawLabel(territory);
    counts.set(territory.id, count);
    labels.append(group);
  }
  element.append(labels);

  return {
    element,

    show(territories) {
      for (const shown of territories) {
        const region = regions.get(shown.id);
        const count = counts.get(shown.id);
        if (!region || !count) continue;

        region.setAttribute("data-player", String(shown.playerNumber));
        region.setAttribute("aria-pressed", String(shown.selected));
        region.setAttribute(
          "aria-label",
          `${shown.name}, held by ${shown.owner}, ${armiesInWords(shown.armies)}`,
        );
        count.textContent = String(shown.armies);
      }
    },

    onTap(handler) {
      element.addEventListener("click", (event) => {
        const id = territoryUnder(event.target);
        if (id !== null) handler(id);
      });
    },
  };
}

function drawRegion(territory: Territory): SVGElement {
  const region = document.createElementNS(SVG_NS, "polygon");
  region.setAttribute(
    "points",
    territory.shape.map((point) => `${point.x},${point.y}`).join(" "),
  );
  region.setAttribute("class", "territory");
  region.setAttribute("data-territory", territory.id);
  region.setAttribute("data-continent", territory.continent);
  region.setAttribute("role", "button");
  region.setAttribute("tabindex", "0");
  region.setAttribute("aria-pressed", "false");
  return region;
}

function drawLabel(territory: Territory): { group: SVGElement; count: SVGElement } {
  const centre = centreOf(territory.shape);
  const group = document.createElementNS(SVG_NS, "g");

  const name = document.createElementNS(SVG_NS, "text");
  name.setAttribute("class", "territory__name");
  name.setAttribute("x", String(centre.x));
  name.setAttribute("y", String(centre.y - 4));
  name.setAttribute("text-anchor", "middle");
  name.textContent = territory.name;

  const count = document.createElementNS(SVG_NS, "text");
  count.setAttribute("class", "territory__armies");
  count.setAttribute("data-armies", territory.id);
  count.setAttribute("x", String(centre.x));
  count.setAttribute("y", String(centre.y + 6));
  count.setAttribute("text-anchor", "middle");
  count.textContent = "0";

  group.append(name, count);
  return { group, count };
}

function armiesInWords(armies: number): string {
  return armies === 1 ? "1 army" : `${armies} armies`;
}

function territoryUnder(target: EventTarget | null): TerritoryId | null {
  if (!(target instanceof Element)) return null;
  const region = target.closest<SVGElement>("[data-territory]");
  return region?.dataset["territory"] ?? null;
}
