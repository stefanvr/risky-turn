"""Draw the board SVG as a picture, at the size a phone shows it.

    PICTURE_TO=/tmp/board.svg PICTURE_ARM=cairn pnpm vitest run src/dev/picture.test.ts
    python3 scripts/board-picture.py /tmp/board.svg /tmp/board.png [scale]

jsdom paints nothing, so a change to how the board looks cannot be seen from
a test. This reads the SVG the renderer actually produced and the colours and
opacities `src/styles.css` actually sets, and writes a PNG. Letterforms are a
3x5 grid rather than the browser's font: it is for judging layout, contrast
and whether a mark carries, not for judging type.
"""
import os, re, sys, zlib, struct

SVG = sys.argv[1]
OUT = sys.argv[2]
SCALE_UP = int(sys.argv[3]) if len(sys.argv) > 3 else 1

BOX_W, BOX_H = 366, 560           # the map's share of a 390px phone
PALETTE = {
    "sea": (0x14, 0x20, 0x2b), "land": (0x3d, 0x54, 0x68),
    "1": (0xc1, 0x54, 0x3f), "2": (0x3f, 0x7f, 0xc1), "3": (0x4f, 0x9e, 0x6a),
    "4": (0xb7, 0x8b, 0x3a), "5": (0x8a, 0x5b, 0xb0), "6": (0x3f, 0x9e, 0xa6),
    "ink": (0xee, 0xf3, 0xf7), "dim": (0x9f, 0xb3, 0xc4),
    "accent": (0xff, 0xd4, 0x79), "border": (0x14, 0x20, 0x2b),
}

svg = open(SVG).read()
view = re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', svg)
MW, MH = float(view.group(1)), float(view.group(2))
scale = min(BOX_W / MW, BOX_H / MH) * SCALE_UP
W, H = int(BOX_W * SCALE_UP), int(BOX_H * SCALE_UP)
ox = (W - MW * scale) / 2
oy = (H - MH * scale) / 2

SHEET = open(os.path.join(os.path.dirname(__file__), "..", "src", "styles.css")).read()
VEIL = float(re.search(r'data-reach="out"\]\s*\{[^}]*fill-opacity:\s*([\d.]+)', SHEET).group(1))
VEIL_INK = float(re.search(r'\.force\[data-reach="out"\]\s*\{[^}]*opacity:\s*([\d.]+)', SHEET).group(1))

pixels = [[PALETTE["sea"] for _ in range(W)] for _ in range(H)]


def at(x, y):
    return (x * scale + ox, y * scale + oy)


def blend(x, y, colour, alpha):
    if not (0 <= x < W and 0 <= y < H):
        return
    under = pixels[y][x]
    pixels[y][x] = tuple(int(under[i] + (colour[i] - under[i]) * alpha) for i in range(3))


def fill(points, colour, alpha=1.0):
    if not points:
        return
    ys = [p[1] for p in points]
    for y in range(max(0, int(min(ys))), min(H, int(max(ys)) + 1)):
        crossings = []
        for i in range(len(points)):
            (x1, y1), (x2, y2) = points[i], points[(i + 1) % len(points)]
            if (y1 > y + 0.5) != (y2 > y + 0.5):
                crossings.append(x1 + (y + 0.5 - y1) / (y2 - y1) * (x2 - x1))
        crossings.sort()
        for i in range(0, len(crossings) - 1, 2):
            for x in range(max(0, int(crossings[i])), min(W, int(crossings[i + 1]) + 1)):
                blend(x, y, colour, alpha)


def stroke(points, colour, width=1.0, closed=True, dash=None, alpha=1.0):
    edges = list(zip(points, points[1:] + ([points[0]] if closed else [])))
    travelled = 0.0
    for (x1, y1), (x2, y2) in edges:
        steps = max(1, int(max(abs(x2 - x1), abs(y2 - y1)) * 2))
        for s in range(steps + 1):
            t = s / steps
            travelled += ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 / steps
            if dash and (travelled % (dash * 2)) > dash:
                continue
            cx, cy = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            r = width / 2
            for dy in range(int(-r), int(r) + 1):
                for dx in range(int(-r), int(r) + 1):
                    blend(int(cx + dx), int(cy + dy), colour, alpha)


FONT = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"], "J": ["001", "001", "001", "101", "010"],
    "K": ["101", "110", "100", "110", "101"], "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"], "N": ["101", "111", "111", "111", "101"],
    "O": ["010", "101", "101", "101", "010"], "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "111", "011"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "011"], "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["111", "001", "111", "100", "111"], "3": ["111", "001", "011", "001", "111"],
    "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "111", "001", "111"],
    "6": ["111", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "111"],
    " ": ["000", "000", "000", "000", "000"],
}


def text(s, cx, cy, size, colour, anchor="middle", alpha=1.0):
    """A 3x5 cell per glyph, sized so the row is `size` pixels tall."""
    dot = max(1, round(size / 5))
    advance = dot * 4
    width = len(s) * advance
    left = cx - width / 2 if anchor == "middle" else cx
    top = cy - dot * 2.5
    for i, ch in enumerate(s.upper()):
        rows = FONT.get(ch, FONT[" "])
        for r, row in enumerate(rows):
            for c, on in enumerate(row):
                if on == "0":
                    continue
                for dy in range(dot):
                    for dx in range(dot):
                        px, py = int(left + i * advance + c * dot + dx), int(top + r * dot + dy)
                        blend(px, py, colour, alpha)


def points_of(attr):
    return [at(float(x), float(y)) for x, y in
            (pair.split(",") for pair in attr.split())]


# Land, in its owner's colour.
for tag in re.finditer(r"<polygon[^>]*class=\"territory\"[^>]*>", svg):
    body = tag.group(0)
    player = re.search(r'data-player="(\d)"', body)
    veiled = 'data-reach="out"' in body
    shape = points_of(re.search(r'points="([^"]+)"', body).group(1))
    fill(shape, PALETTE[player.group(1)] if player else PALETTE["land"], VEIL if veiled else 1.0)
    stroke(shape, PALETTE["border"], width=max(1, scale * 1))

# The outer edge of each continent.
COAST = float(re.search(r'\.continent__coast\s*\{[^}]*opacity:\s*([\d.]+)', SHEET).group(1))
COAST_W = float(re.search(r'\.continent__coast\s*\{[^}]*stroke-width:\s*([\d.]+)', SHEET).group(1))
for tag in re.finditer(r'<path[^>]*class="continent__coast"[^>]*d="([^"]+)"', svg):
    for loop in tag.group(1).split("M ")[1:]:
        pts = [tuple(map(float, pair.split(" ")))
               for pair in loop.replace(" Z", "").strip().split(" L ")]
        stroke([at(x, y) for x, y in pts], PALETTE["dim"],
               width=max(1, scale * COAST_W), alpha=COAST)

# Water a bomber crosses.
for tag in re.finditer(r"<line[^>]*class=\"sea-link\"[^>]*>", svg):
    body = tag.group(0)
    get = lambda name: float(re.search(f'{name}="([^"]+)"', body).group(1))
    stroke([at(get("x1"), get("y1")), at(get("x2"), get("y2"))],
           PALETTE["dim"], width=max(1, scale * 1.2), closed=False, dash=scale * 2)

# Works dug in, and the selection.
for tag in re.finditer(r"<polygon[^>]*class=\"territory__line\"[^>]*>", svg):
    body = tag.group(0)
    state = re.search(r'data-line="(\w+)"', body).group(1)
    if state == "none":
        continue
    shape = points_of(re.search(r'points="([^"]+)"', body).group(1))
    stroke(shape, PALETTE["ink"], width=max(1, scale * (2.2 if state == "holding" else 1.2)),
           dash=None if state == "holding" else scale * 3)

for tag in re.finditer(r"<polygon[^>]*class=\"cell__selection\"[^>]*style=\"([^\"]*)\"[^>]*>", svg):
    if "display: none" in tag.group(1):
        continue
    shape = points_of(re.search(r'points="([^"]+)"', tag.group(0)).group(1))
    stroke(shape, PALETTE["accent"], width=max(2, scale * 3))

# Names.
for tag in re.finditer(r"<text[^>]*class=\"territory__name\"[^>]*>([^<]*)</text>", svg):
    body = tag.group(0)
    x = float(re.search(r'x="([^"]+)"', body).group(1))
    y = float(re.search(r'y="([^"]+)"', body).group(1))
    px, py = at(x, y)
    text(tag.group(1), px, py - 4.5 * scale * 0.35, 4.5 * scale, PALETTE["dim"],
         alpha=VEIL_INK if 'data-reach="out"' in body else 1.0)

# Force icons and counts.
for group in re.finditer(r"<g class=\"force territory__(armies|bombers)\"[^>]*>(.*?)</g>", svg, re.S):
    force, body = group.group(1), group.group(2)
    if 'style="display: none' in group.group(0) or "display: none" in group.group(0):
        continue
    icon = re.search(r'd="([^"]+)"[^>]*transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"', body)
    if not icon:
        icon = re.search(r'transform="translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)"', body)
    d = re.search(r'd="([^"]+)"', body).group(1)
    move = re.search(r'translate\(([-\d.]+) ([-\d.]+)\) scale\(([\d.]+)\)', body)
    tx, ty, sc = float(move.group(1)), float(move.group(2)), float(move.group(3))
    veiled = 'data-reach="out"' in group.group(0)
    for polygon in d.split("M ")[1:]:
        pts = [tuple(map(float, pair.split(" "))) for pair in
               polygon.replace(" Z", "").strip().split(" L ")]
        fill([at(tx + px * sc, ty + py * sc) for px, py in pts], PALETTE["ink"],
             VEIL_INK if veiled else 1.0)
    count = re.search(r'<text[^>]*x="([-\d.]+)"[^>]*y="([-\d.]+)"[^>]*>([^<]*)</text>', body)
    size = (8 if force == "armies" else 6) * scale
    cx, cy = at(float(count.group(1)), float(count.group(2)))
    text(count.group(3), cx, cy, size, PALETTE["ink"], anchor="start",
         alpha=VEIL_INK if veiled else 1.0)


def png(path):
    raw = b""
    for row in pixels:
        raw += b"\x00" + b"".join(bytes(c) for c in row)
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF))
    header = struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0)
    open(path, "wb").write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header)
                           + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))


png(OUT)
print(f"wrote {OUT} at {W}x{H}")
