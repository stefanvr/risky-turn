import type { TerritoryId } from "../domain/map";

/**
 * At most one territory is selected at a time. Tapping the selected territory
 * again clears it, so a player can always back out of a selection with the
 * same gesture that made it.
 */
export function nextSelection(
  current: TerritoryId | null,
  tapped: TerritoryId,
): TerritoryId | null {
  return current === tapped ? null : tapped;
}
