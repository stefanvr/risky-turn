import type { GameMap } from "../domain/map";

/**
 * A deliberately tiny map that exists to prove the pipe from authored data to
 * a tappable region on screen. It is not the map the game is played on; see
 * PRODUCT.md, which settles one fixed hand-authored world map. Delete this
 * once that map exists.
 */
export const provingMap: GameMap = {
  id: "proving",
  name: "Proving Ground",
  width: 100,
  height: 160,
  continents: [
    { id: "north", name: "Northland", bonus: 2 },
    { id: "south", name: "Southland", bonus: 1 },
  ],
  territories: [
    {
      id: "alfa",
      name: "Alfa",
      continent: "north",
      neighbours: ["bravo", "charlie"],
      shape: [
        { x: 8, y: 8 },
        { x: 50, y: 8 },
        { x: 50, y: 58 },
        { x: 8, y: 58 },
      ],
    },
    {
      id: "bravo",
      name: "Bravo",
      continent: "north",
      neighbours: ["alfa", "charlie"],
      shape: [
        { x: 50, y: 8 },
        { x: 92, y: 8 },
        { x: 92, y: 58 },
        { x: 50, y: 58 },
      ],
    },
    {
      id: "charlie",
      name: "Charlie",
      continent: "north",
      neighbours: ["alfa", "bravo", "delta", "echo"],
      shape: [
        { x: 8, y: 58 },
        { x: 92, y: 58 },
        { x: 92, y: 100 },
        { x: 8, y: 100 },
      ],
    },
    {
      id: "delta",
      name: "Delta",
      continent: "south",
      neighbours: ["charlie", "echo"],
      shape: [
        { x: 8, y: 100 },
        { x: 50, y: 100 },
        { x: 50, y: 152 },
        { x: 8, y: 152 },
      ],
    },
    {
      id: "echo",
      name: "Echo",
      continent: "south",
      neighbours: ["charlie", "delta"],
      shape: [
        { x: 50, y: 100 },
        { x: 92, y: 100 },
        { x: 92, y: 152 },
        { x: 50, y: 152 },
      ],
    },
  ],
};
