import { mountMap } from "./ui/mapInteraction";
import { provingMap } from "./maps/proving";
import "./styles.css";

const host = document.querySelector("#map");
const caption = document.querySelector("#caption");
if (!host || !caption) throw new Error("page is missing its map or caption element");

const nameOf = new Map(provingMap.territories.map((t) => [t.id, t.name]));

mountMap(host, provingMap, {
  onSelectionChanged: (selected) => {
    caption.textContent = selected === null
      ? "Tap a territory."
      : `${nameOf.get(selected)} selected.`;
  },
});
