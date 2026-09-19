import { beforeEach, describe, expect, it } from "vitest";
import { mountMap } from "./mapInteraction";
import { provingMap } from "../maps/proving";

function tap(root: ParentNode, territoryId: string): void {
  const region = root.querySelector<SVGElement>(`[data-territory="${territoryId}"]`);
  if (!region) throw new Error(`no region drawn for ${territoryId}`);
  region.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

function selected(root: ParentNode): string[] {
  return [...root.querySelectorAll<SVGElement>('[data-territory][aria-pressed="true"]')].map(
    (region) => region.dataset["territory"]!,
  );
}

describe("tapping the map", () => {
  let host: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = "";
    host = document.createElement("div");
    document.body.append(host);
  });

  it("selects the territory that was tapped", () => {
    mountMap(host, provingMap);
    tap(host, "alfa");
    expect(selected(host)).toEqual(["alfa"]);
  });

  it("keeps selection exclusive when a second territory is tapped", () => {
    mountMap(host, provingMap);
    tap(host, "alfa");
    tap(host, "bravo");
    expect(selected(host)).toEqual(["bravo"]);
  });

  it("clears the selection when the selected territory is tapped again", () => {
    mountMap(host, provingMap);
    tap(host, "alfa");
    tap(host, "alfa");
    expect(selected(host)).toEqual([]);
  });

  it("reports the current selection to its caller", () => {
    const seen: (string | null)[] = [];
    mountMap(host, provingMap, { onSelectionChanged: (id) => seen.push(id) });
    tap(host, "alfa");
    tap(host, "bravo");
    tap(host, "bravo");
    expect(seen).toEqual(["alfa", "bravo", null]);
  });
});
