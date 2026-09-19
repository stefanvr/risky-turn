import { createMapView } from "../render/mapView";
import { nextSelection } from "./selection";
import type { GameMap, TerritoryId } from "../domain/map";

export interface MountOptions {
  readonly onSelectionChanged?: (selected: TerritoryId | null) => void;
}

export interface MountedMap {
  readonly element: SVGSVGElement;
  selectedTerritory(): TerritoryId | null;
}

/**
 * Wires taps on a drawn map to the selection rule and back to the view.
 * The selection lives here, not in the view, so the rule stays testable
 * without a DOM and the view stays replaceable.
 */
export function mountMap(
  host: Element,
  map: GameMap,
  options: MountOptions = {},
): MountedMap {
  const view = createMapView(map);
  let selected: TerritoryId | null = null;

  view.onTap((tapped) => {
    selected = nextSelection(selected, tapped);
    view.showSelection(selected);
    options.onSelectionChanged?.(selected);
  });

  view.showSelection(selected);
  host.append(view.element);

  return {
    element: view.element,
    selectedTerritory: () => selected,
  };
}
