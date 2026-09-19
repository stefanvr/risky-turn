import { centreOf, validateMap } from "../domain/map";
import type { GameMap, Territory, TerritoryId } from "../domain/map";

const SVG_NS = "http://www.w3.org/2000/svg";

export interface MapView {
  readonly element: SVGSVGElement;
  /** Reflects a selection decided elsewhere. Decides nothing itself. */
  showSelection(selected: TerritoryId | null): void;
  /** Reports the territory under a tap. */
  onTap(handler: (territory: TerritoryId) => void): void;
}

/**
 * Draws a map as SVG. The view holds no game or selection state: it renders
 * what it is given and reports what was tapped, so it can be replaced without
 * touching domain or interaction logic.
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
  const labels = document.createElementNS(SVG_NS, "g");
  labels.setAttribute("class", "map__labels");
  labels.setAttribute("aria-hidden", "true");

  for (const territory of map.territories) {
    const region = drawRegion(territory);
    regions.set(territory.id, region);
    element.append(region);
    labels.append(drawLabel(territory));
  }
  element.append(labels);

  return {
    element,
    showSelection(selected) {
      for (const [id, region] of regions) {
        region.setAttribute("aria-pressed", String(id === selected));
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
  region.setAttribute("aria-label", territory.name);
  region.setAttribute("aria-pressed", "false");
  return region;
}

function drawLabel(territory: Territory): SVGElement {
  const centre = centreOf(territory.shape);
  const label = document.createElementNS(SVG_NS, "text");
  label.setAttribute("class", "territory__label");
  label.setAttribute("x", String(centre.x));
  label.setAttribute("y", String(centre.y));
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("dominant-baseline", "central");
  label.textContent = territory.name;
  return label;
}

function territoryUnder(target: EventTarget | null): TerritoryId | null {
  if (!(target instanceof Element)) return null;
  const region = target.closest<SVGElement>("[data-territory]");
  return region?.dataset["territory"] ?? null;
}
