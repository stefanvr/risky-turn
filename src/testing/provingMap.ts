import type { GameMap } from "../domain/map";

/**
 * The board the tests are written against: five lettered territories, small
 * enough that a test can state a whole position in a line and be read back as
 * the board it is about. The game itself is played on `src/maps/world.ts`;
 * nothing outside tests may use this one.
 *
 * Alfa and Echo are linked by sea: no army can cross between them, but a
 * bomber can. Every territory here happens to be within a bomber's overland
 * reach as well, so the link's own value shows in what ground cannot do.
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
      seaLinks: ["echo"],
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
      seaLinks: ["alfa"],
      shape: [
        { x: 50, y: 100 },
        { x: 92, y: 100 },
        { x: 92, y: 152 },
        { x: 50, y: 152 },
      ],
    },
  ],
};
