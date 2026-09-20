import { centreOf, validateMap } from "../domain/map";
import type { GameMap, Point, Territory, TerritoryId } from "../domain/map";
import type { TerritoryPresentation } from "../ui/presentation";

const SVG_NS = "http://www.w3.org/2000/svg";

let viewsMade = 0;

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
  const lines = new Map<TerritoryId, SVGElement>();
  const squadrons = new Map<TerritoryId, { group: SVGElement; count: SVGElement }>();
  const marks = new Map<TerritoryId, SVGElement>();

  // Unique per view, so two maps on one page cannot claim each other's clips.
  const scope = `map${(viewsMade += 1)}`;
  const shapes = document.createElementNS(SVG_NS, "defs");
  const selections = document.createElementNS(SVG_NS, "g");
  selections.setAttribute("class", "map__selection");
  selections.setAttribute("aria-hidden", "true");
  const works = document.createElementNS(SVG_NS, "g");
  works.setAttribute("class", "map__lines");
  works.setAttribute("aria-hidden", "true");
  const labels = document.createElementNS(SVG_NS, "g");
  labels.setAttribute("class", "map__labels");
  labels.setAttribute("aria-hidden", "true");

  for (const territory of map.territories) {
    const region = drawRegion(territory);
    regions.set(territory.id, region);
    element.append(region);

    shapes.append(clipOf(territory, scope));
    const mark = drawSelection(territory, scope);
    marks.set(territory.id, mark);
    selections.append(mark);

    const line = drawLine(territory);
    lines.set(territory.id, line);
    works.append(line);

    const { group, count } = drawLabel(territory);
    counts.set(territory.id, count);
    labels.append(group);

    const squadron = drawSquadron(territory);
    squadrons.set(territory.id, squadron);
    labels.append(squadron.group);
  }
  // Painted after the regions: SVG has no z-index, so anything drawn before
  // them is simply covered by opaque ground.
  element.append(shapes, drawSeaLinks(map), works, selections, labels);

  return {
    element,

    show(territories) {
      for (const shown of territories) {
        const region = regions.get(shown.id);
        const count = counts.get(shown.id);
        const line = lines.get(shown.id);
        if (!region || !count || !line) continue;

        line.setAttribute("data-line", shown.line);

        const squadron = squadrons.get(shown.id);
        if (squadron) {
          squadron.group.setAttribute("data-bombers-for", shown.id);
          squadron.group.setAttribute("data-bombers", String(shown.bombers));
          squadron.group.style.display = shown.bombers > 0 ? "" : "none";
          squadron.group.setAttribute("data-poised", shown.poised ?? "none");
          squadron.count.textContent = String(shown.bombers);
        }

        region.setAttribute("data-player", String(shown.playerNumber));
        region.setAttribute("aria-pressed", String(shown.selected));
        region.setAttribute("data-poised", shown.poised ?? "none");

        const mark = marks.get(shown.id);
        if (mark) mark.style.display = shown.selected ? "" : "none";
        region.setAttribute(
          "aria-label",
          `${shown.name}, held by ${shown.owner}, ${armiesInWords(shown.armies)}` +
            `${bombersInWords(shown.bombers)}${lineInWords(shown.line)}`,
        );
        count.textContent = String(shown.armies);
        count.setAttribute("data-poised", shown.poised ?? "none");
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

/**
 * A line is drawn as an outline set inside the territory's own border, so it
 * reads as works dug within the ground rather than competing with the
 * selection outline on the border itself.
 */
function drawLine(territory: Territory): SVGElement {
  const line = document.createElementNS(SVG_NS, "polygon");
  line.setAttribute("class", "territory__line");
  line.setAttribute("data-line-for", territory.id);
  line.setAttribute("data-line", "none");
  line.setAttribute(
    "points",
    inset(territory.shape, 0.16)
      .map((point) => `${point.x},${point.y}`)
      .join(" "),
  );
  return line;
}

/** The same shape, pulled towards its centre by a fraction of its size. */
function inset(shape: readonly Point[], fraction: number): Point[] {
  const centre = centreOf(shape);
  return shape.map((point) => ({
    x: point.x + (centre.x - point.x) * fraction,
    y: point.y + (centre.y - point.y) * fraction,
  }));
}

/** A wing and a count, shown only where bombers actually stand. */
function drawSquadron(territory: Territory): { group: SVGElement; count: SVGElement } {
  const centre = centreOf(territory.shape);
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", "territory__bombers");
  group.setAttribute("data-bombers-for", territory.id);
  group.setAttribute("data-bombers", "0");
  group.style.display = "none";

  const wing = document.createElementNS(SVG_NS, "path");
  wing.setAttribute("class", "bomber__wing");
  const x = centre.x - 5;
  const y = centre.y + 13;
  wing.setAttribute("d", `M ${x} ${y} l 7 -3 l -7 -3 l 1.6 3 z`);

  const count = document.createElementNS(SVG_NS, "text");
  count.setAttribute("class", "territory__bomberCount");
  count.setAttribute("x", String(centre.x + 5));
  count.setAttribute("y", String(centre.y + 13));
  count.setAttribute("text-anchor", "middle");
  count.setAttribute("dominant-baseline", "central");
  count.textContent = "0";

  group.append(wing, count);
  return { group, count };
}

const clipIdOf = (territory: Territory, scope: string) => `${scope}-clip-${territory.id}`;

function clipOf(territory: Territory, scope: string): SVGElement {
  const clip = document.createElementNS(SVG_NS, "clipPath");
  clip.setAttribute("id", clipIdOf(territory, scope));
  clip.append(polygonOf(territory.shape));
  return clip;
}

/**
 * The selection outline, drawn after every cell and clipped to its own, so the
 * half of the stroke that would fall outside is cut away rather than painted
 * over by whichever neighbour happens to be drawn later. The visible mark
 * therefore lies inside the cell it marks.
 */
function drawSelection(territory: Territory, scope: string): SVGElement {
  const mark = polygonOf(territory.shape);
  mark.setAttribute("class", "cell__selection");
  mark.setAttribute("data-selected-for", territory.id);
  mark.setAttribute("clip-path", `url(#${clipIdOf(territory, scope)})`);
  mark.style.display = "none";
  return mark;
}

function polygonOf(shape: readonly Point[]): SVGPolygonElement {
  const polygon = document.createElementNS(SVG_NS, "polygon");
  polygon.setAttribute("points", shape.map((point) => `${point.x},${point.y}`).join(" "));
  return polygon;
}

/** Water, drawn as the dashed run a bomber can cross and an army cannot. */
function drawSeaLinks(map: GameMap): SVGElement {
  const water = document.createElementNS(SVG_NS, "g");
  water.setAttribute("class", "map__sea");
  water.setAttribute("aria-hidden", "true");

  const drawn = new Set<string>();
  for (const territory of map.territories) {
    for (const across of territory.seaLinks ?? []) {
      const pair = [territory.id, across].sort().join("~");
      if (drawn.has(pair)) continue;
      drawn.add(pair);

      const other = map.territories.find((candidate) => candidate.id === across);
      if (!other) continue;
      const here = centreOf(territory.shape);
      const there = centreOf(other.shape);

      const link = document.createElementNS(SVG_NS, "line");
      link.setAttribute("class", "sea-link");
      link.setAttribute("data-sea-link", pair);
      link.setAttribute("x1", String(here.x));
      link.setAttribute("y1", String(here.y));
      link.setAttribute("x2", String(there.x));
      link.setAttribute("y2", String(there.y));
      water.append(link);
    }
  }
  return water;
}

function bombersInWords(bombers: number): string {
  if (bombers === 0) return "";
  return bombers === 1 ? ", 1 bomber" : `, ${bombers} bombers`;
}

function lineInWords(line: TerritoryPresentation["line"]): string {
  if (line === "building") return ", digging in";
  return line === "holding" ? ", dug in" : "";
}

function armiesInWords(armies: number): string {
  return armies === 1 ? "1 army" : `${armies} armies`;
}

function territoryUnder(target: EventTarget | null): TerritoryId | null {
  if (!(target instanceof Element)) return null;
  const region = target.closest<SVGElement>("[data-territory]");
  return region?.dataset["territory"] ?? null;
}
