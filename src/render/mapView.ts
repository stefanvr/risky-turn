import { centreOf, validateMap } from "../domain/map";
import { coastsOf } from "./coast";
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
  const names = new Map<TerritoryId, SVGElement>();
  const lines = new Map<TerritoryId, SVGElement>();
  const armies = new Map<TerritoryId, { group: SVGElement; count: SVGElement }>();
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

    const name = drawName(territory);
    names.set(territory.id, name);
    labels.append(name);

    const army = drawForce(territory, "armies");
    armies.set(territory.id, army);
    labels.append(army.group);

    const squadron = drawForce(territory, "bombers");
    squadrons.set(territory.id, squadron);
    labels.append(squadron.group);
  }
  // Painted after the regions: SVG has no z-index, so anything drawn before
  // them is simply covered by opaque ground.
  element.append(shapes, drawCoasts(map), drawSeaLinks(map), works, selections, labels);

  return {
    element,

    show(territories) {
      for (const shown of territories) {
        const region = regions.get(shown.id);
        const army = armies.get(shown.id);
        const line = lines.get(shown.id);
        if (!region || !army || !line) continue;

        line.setAttribute("data-line", shown.line);

        const squadron = squadrons.get(shown.id);
        if (squadron) {
          squadron.group.setAttribute("data-bombers", String(shown.bombers));
          squadron.group.style.display = shown.bombers > 0 ? "" : "none";
          squadron.group.setAttribute("data-poised", shown.poised ?? "none");
          squadron.count.textContent = String(shown.bombers);
        }

        region.setAttribute("data-player", String(shown.playerNumber));
        // Everything drawn for a cell carries the same answer, so a veiled
        // cell goes back as one thing rather than losing only its ground.
        for (const part of [region, names.get(shown.id), army.group, squadron?.group]) {
          part?.setAttribute("data-reach", shown.reach ?? "none");
        }
        region.setAttribute("aria-pressed", String(shown.selected));
        region.setAttribute("data-poised", shown.poised ?? "none");

        const mark = marks.get(shown.id);
        if (mark) mark.style.display = shown.selected ? "" : "none";
        region.setAttribute(
          "aria-label",
          `${shown.name}, held by ${shown.owner}, ${armiesInWords(shown.armies)}` +
            `${bombersInWords(shown.bombers)}${lineInWords(shown.line)}`,
        );
        army.count.textContent = String(shown.armies);
        army.group.setAttribute("data-poised", shown.poised ?? "none");
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

function drawName(territory: Territory): SVGElement {
  const centre = centreOf(territory.shape);
  const name = document.createElementNS(SVG_NS, "text");
  name.setAttribute("class", "territory__name");
  name.setAttribute("data-name-for", territory.id);
  name.setAttribute("x", String(centre.x));
  name.setAttribute("y", String(centre.y + NAME_Y));
  name.setAttribute("text-anchor", "middle");
  name.textContent = territory.name;
  return name;
}

/**
 * Force glyphs, as closed polygons in a 12 x 8 box centred on the origin. A
 * glyph is therefore placed by its own centre, which is what lets a count set
 * on the same line be aligned with it by construction rather than by eye.
 */
type Glyph = readonly (readonly (readonly [number, number])[])[];

const TANK: Glyph = [
  [[-5.6, 1.4], [5.6, 1.4], [5.0, 4.0], [-5.0, 4.0]],       // tracks
  [[-4.8, -1.1], [3.0, -1.1], [4.8, 1.4], [-4.8, 1.4]],     // hull, sloped in front
  [[-2.4, -3.0], [1.2, -3.0], [1.8, -1.1], [-2.8, -1.1]],   // turret
  [[1.4, -2.5], [6.0, -2.5], [6.0, -1.7], [1.4, -1.7]],     // gun
];

const BOMBER: Glyph = [
  [[-5.2, -0.7], [3.0, -0.7], [6.0, 0], [3.0, 0.7], [-5.2, 0.7]],  // fuselage, nose right
  [[0.6, -0.5], [-3.0, -3.7], [-1.4, -3.7], [2.6, -0.5]],          // wing
  [[0.6, 0.5], [-3.0, 3.7], [-1.4, 3.7], [2.6, 0.5]],              // wing
  [[-4.6, -0.5], [-5.8, -2.1], [-4.8, -2.1], [-3.4, -0.5]],        // tailplane
  [[-4.6, 0.5], [-5.8, 2.1], [-4.8, 2.1], [-3.4, 0.5]],            // tailplane
];

/**
 * How a force is laid out under the name: the icons share one column and the
 * counts another, so armies and bombers read as two rows of one thing rather
 * than as two unrelated marks, and neither number has to be remembered as
 * belonging to something.
 */
const NAME_Y = -6;
const ICON_X = -5.5;
const COUNT_X = 0.5;

interface ForceStyle {
  readonly glyph: Glyph;
  readonly icon: string;
  /** Where the row's centre line sits, relative to the cell's centre. */
  readonly y: number;
  readonly scale: number;
}

const FORCES: Readonly<Record<"armies" | "bombers", ForceStyle>> = {
  armies: { glyph: TANK, icon: "tank", y: 3, scale: 0.8 },
  bombers: { glyph: BOMBER, icon: "bomber", y: 10, scale: 0.7 },
};

/** An icon and its count on one line: what a cell has, of one kind. */
function drawForce(
  territory: Territory,
  force: "armies" | "bombers",
): { group: SVGElement; count: SVGElement } {
  const centre = centreOf(territory.shape);
  const style = FORCES[force];
  const line = centre.y + style.y;

  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("class", `force territory__${force}`);
  group.setAttribute(`data-${force}-for`, territory.id);

  const icon = document.createElementNS(SVG_NS, "path");
  icon.setAttribute("class", "force__icon");
  icon.setAttribute("data-force-icon", style.icon);
  icon.setAttribute("d", pathOf(style.glyph));
  icon.setAttribute(
    "transform",
    `translate(${centre.x + ICON_X} ${line}) scale(${style.scale})`,
  );

  const count = document.createElementNS(SVG_NS, "text");
  count.setAttribute("class", "force__count");
  count.setAttribute("x", String(centre.x + COUNT_X));
  count.setAttribute("y", String(line));
  count.setAttribute("text-anchor", "start");
  // The count is centred on the glyph's own line rather than sitting on a
  // baseline of its own, which is what keeps the pair level as digits grow.
  count.setAttribute("dominant-baseline", "central");
  count.textContent = "0";

  group.append(icon, count);
  return { group, count };
}

function pathOf(glyph: Glyph): string {
  return glyph
    .map((polygon) => `M ${polygon.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`)
    .join(" ");
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

/**
 * The outer edge of each continent, so the ground a bonus is paid for reads
 * as one piece and the necks between continents read as the doors they are.
 */
function drawCoasts(map: GameMap): SVGElement {
  const coasts = document.createElementNS(SVG_NS, "g");
  coasts.setAttribute("class", "map__coasts");
  coasts.setAttribute("aria-hidden", "true");

  for (const [continent, loops] of coastsOf(map)) {
    const coast = document.createElementNS(SVG_NS, "path");
    coast.setAttribute("class", "continent__coast");
    coast.setAttribute("data-coast-for", continent);
    coast.setAttribute(
      "d",
      loops
        .map((loop) => `M ${loop.map((point) => `${point.x} ${point.y}`).join(" L ")} Z`)
        .join(" "),
    );
    coasts.append(coast);
  }
  return coasts;
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
