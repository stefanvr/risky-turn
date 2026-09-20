"""Paint the world, and write it out as `src/maps/world.ts`.

The world is authored as the painting below: one character per lattice cell,
one character per territory, '.' for sea. Everything else follows from it —
borders are shared cell edges, so they cannot disagree, and coastlines are
lattice vertices nudged off the grid by a fixed wobble, so neighbours keep
exactly the same coast.

Edit the painting, run `python3 scripts/paint-world.py` from the repository
root, and check the result with `pnpm check`: the tests decide whether what
was painted is playable.
"""
import math
from collections import defaultdict

CELL = 10.0          # map units per lattice cell
JITTER = 2.0         # how far a coastline vertex may wander from the lattice

# The world, one character per lattice cell, '.' for sea.
PAINTING = [
    "..AABBB.....FFFGGG..",
    ".AAABBBBB..FFFFGGGG.",
    ".AAABBBBBBFFFFFGGGG.",
    "AAAABBBBBFFFFFFGGGGG",
    "AAAABBBBB..FFFFGGGG.",
    ".CCDDDEEE.HHHIIIIJJ.",
    "CCCDDDEEE.HHHIIIIJJJ",
    "CCCDDDEEE.HHHIIIIJJJ",
    "CCCDDDEEE.HHHIIIIJJJ",
    "CCCDDDEE..HHHIII.JJ.",
    ".CC...........II....",
    ".KK...........PP....",
    "KKKKLLL..OOOPPPPQQQ.",
    "KKKKLLLLOOOOPPPPQQQQ",
    "KKKKLLLOOOOOPPPPQQQQ",
    "KKKKLLL.OOOOPPPPQQQQ",
    ".MMMNNN.RRRSSSTTTUU.",
    ".MMMNNN.RRRSSSTTTUUU",
    "MMMMNNN.RRRSSSTTTUUU",
    "MMMMNNN.RRRSSSTTTUUU",
    ".MMMNNN.RRRSSSTTTUU.",
    ".MM.....RR..........",
    ".VV.....XX..........",
    ".VVVWWWWXXX...111222",
    "VVVVWWWWXXXXX1111222",
    "VVVVWWWWXXXX11111222",
    ".VVVWWWWXXX...111222",
    ".YYYYYZZZZZZ.333344.",
    "YYYYYYZZZZZZ.3333444",
    "YYYYYYZZZZZZ.3333444",
    "YYYYYYZZZZZ..3333444",
    ".YYYYYZZZZZ..333.444",
]

CONTINENTS = [
    ("kelder", "Kelder Reach", 4, "ABCDE"),
    ("vashteru", "Vashteru", 4, "FGHIJ"),
    ("mourne", "Mourne", 2, "KLMN"),
    ("tarrowgate", "Tarrowgate", 6, "OPQRSTU"),
    ("sundering", "The Sundering", 3, "VWXYZ"),
    ("oskan", "Oskan Deep", 2, "1234"),
]

NAMES = {
    "A": "Vint", "B": "Hallow", "C": "Brack", "D": "Orme", "E": "Skell",
    "F": "Ashan", "G": "Turek", "H": "Oru", "I": "Zemin", "J": "Kavat",
    "K": "Greyfen", "L": "Lowry", "M": "Cairn", "N": "Dunmar",
    "O": "Harrow", "P": "Mellin", "Q": "Sarn", "R": "Verrick",
    "S": "Ostal", "T": "Brinn", "U": "Calder",
    "V": "Rift", "W": "Sable", "X": "Kethra", "Y": "Morrow", "Z": "Drell",
    "1": "Oska", "2": "Nale", "3": "Tiv", "4": "Hulm",
}

# Water a bomber crosses and an army cannot.
SEA_LINKS = [("E", "H"), ("D", "K"), ("J", "Q"), ("N", "R"), ("Z", "3"), ("2", "U")]

ROWS = len(PAINTING)
COLS = len(PAINTING[0])
WIDTH = COLS * CELL
HEIGHT = ROWS * CELL

for row in PAINTING:
    assert len(row) == COLS, f"row of {len(row)}: {row}"


def cells():
    owned = defaultdict(list)
    for r, row in enumerate(PAINTING):
        for c, mark in enumerate(row):
            if mark != ".":
                owned[mark].append((r, c))
    return owned


def jitter_at(col, row):
    """A deterministic wobble, shared by every shape meeting at this vertex."""
    seed = math.sin(col * 12.9898 + row * 78.233) * 43758.5453
    dx = (seed - math.floor(seed)) * 2 - 1
    seed = math.sin(col * 39.3468 + row * 11.135) * 24634.6345
    dy = (seed - math.floor(seed)) * 2 - 1
    x = min(max(col * CELL + dx * JITTER, 0.4), WIDTH - 0.4)
    y = min(max(row * CELL + dy * JITTER, 0.4), HEIGHT - 0.4)
    return (round(x, 1), round(y, 1))


def outline(owned):
    """Trace the boundary of a set of cells as one loop of lattice vertices."""
    held = set(owned)
    edges = {}
    for (r, c) in held:
        # Each boundary edge is walked so the interior stays on the left,
        # which makes the loop stitch together in one direction.
        if (r - 1, c) not in held:
            edges.setdefault((c, r), []).append((c + 1, r))
        if (r + 1, c) not in held:
            edges.setdefault((c + 1, r + 1), []).append((c, r + 1))
        if (r, c - 1) not in held:
            edges.setdefault((c, r + 1), []).append((c, r))
        if (r, c + 1) not in held:
            edges.setdefault((c + 1, r), []).append((c + 1, r + 1))

    for start, outs in edges.items():
        assert len(outs) == 1, f"vertex {start} is used twice: a pinch point"

    start = min(edges)
    loop = [start]
    here = edges[start][0]
    while here != start:
        loop.append(here)
        here = edges[here][0]
    assert len(loop) == len(edges), "the coast did not close in one loop"
    return loop


def neighbours(owned_all):
    touching = defaultdict(set)
    for mark, owned in owned_all.items():
        for (r, c) in owned:
            for (dr, dc) in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                other = PAINTING[r + dr][c + dc] if 0 <= r + dr < ROWS and 0 <= c + dc < COLS else "."
                if other not in (".", mark):
                    touching[mark].add(other)
    return touching


def main():
    owned_all = cells()
    assert set(owned_all) == set(NAMES), set(NAMES) ^ set(owned_all)
    touching = neighbours(owned_all)
    sea = defaultdict(set)
    for a, b in SEA_LINKS:
        sea[a].add(b)
        sea[b].add(a)
        assert b not in touching[a], f"sea link {a}-{b} runs where a border does"

    shapes = {mark: [jitter_at(c, r) for (c, r) in outline(owned)]
              for mark, owned in owned_all.items()}

    land = sum(len(owned) for owned in owned_all.values())
    print(f"{len(owned_all)} territories, {land}/{ROWS * COLS} cells land "
          f"({100 - land * 100 / (ROWS * COLS):.0f}% sea)")
    for mark, owned in sorted(owned_all.items()):
        print(f"  {mark} {NAMES[mark]:9} {len(owned):3} cells  "
              f"borders {''.join(sorted(touching[mark]))}")

    ident = {mark: NAMES[mark].lower() for mark in NAMES}
    out = []
    out.append('import type { GameMap } from "../domain/map";')
    out.append("")
    out.append("/**")
    out.append(" * Written by scripts/paint-world.py. Edit the painting there, not this.")
    out.append(" *")
    out.append(" * The world Risky Turn is played on: six continents, thirty territories,")
    out.append(" * laid out portrait so an upright phone shows the whole board at once.")
    out.append(" *")
    out.append(" * Continents meet only at narrow necks, so a held continent has few doors;")
    out.append(" * sea links are water that bombers cross and armies never do. Every")
    out.append(" * territory is reachable over land from every other, or conquest could not")
    out.append(" * be completed.")
    out.append(" *")
    out.append(" * PROVISIONAL: the continent bonuses, like the other open numbers in")
    out.append(" * docs/rules.md, stand until a full game has been played.")
    out.append(" */")
    out.append("export const worldMap: GameMap = {")
    out.append('  id: "world",')
    out.append('  name: "Kelder World",')
    out.append(f"  width: {WIDTH:.0f},")
    out.append(f"  height: {HEIGHT:.0f},")
    out.append("  continents: [")
    for cid, cname, bonus, marks in CONTINENTS:
        out.append(f'    {{ id: "{cid}", name: "{cname}", bonus: {bonus} }},')
    out.append("  ],")
    out.append("  territories: [")
    for cid, cname, bonus, marks in CONTINENTS:
        out.append(f"    // {cname}")
        for mark in marks:
            out.append("    {")
            out.append(f'      id: "{ident[mark]}",')
            out.append(f'      name: "{NAMES[mark]}",')
            out.append(f'      continent: "{cid}",')
            near = ", ".join(f'"{ident[m]}"' for m in sorted(touching[mark], key=lambda m: ident[m]))
            out.append(f"      neighbours: [{near}],")
            if sea[mark]:
                across = ", ".join(f'"{ident[m]}"' for m in sorted(sea[mark], key=lambda m: ident[m]))
                out.append(f"      seaLinks: [{across}],")
            out.append("      shape: [")
            for (x, y) in shapes[mark]:
                out.append(f"        {{ x: {x}, y: {y} }},")
            out.append("      ],")
            out.append("    },")
    out.append("  ],")
    out.append("};")
    out.append("")

    with open("src/maps/world.ts", "w") as handle:
        handle.write("\n".join(out))
    print("wrote src/maps/world.ts")


main()
