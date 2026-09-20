const SVG_NS = "http://www.w3.org/2000/svg";

/** Pip positions on a 3x3 grid, by face. */
const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

/**
 * A die drawn rather than typed. The Unicode dice characters depend on a font
 * the phone may not have, and a die nobody can read is the same as no die.
 */
export function drawDie(value: number): SVGSVGElement {
  const die = document.createElementNS(SVG_NS, "svg");
  die.setAttribute("class", "die");
  die.setAttribute("viewBox", "0 0 24 24");
  die.setAttribute("data-die", String(value));
  die.setAttribute("role", "img");
  die.setAttribute("aria-label", `${value}`);

  const body = document.createElementNS(SVG_NS, "rect");
  body.setAttribute("class", "die__body");
  body.setAttribute("x", "1.5");
  body.setAttribute("y", "1.5");
  body.setAttribute("width", "21");
  body.setAttribute("height", "21");
  body.setAttribute("rx", "4");
  die.append(body);

  for (const [column, row] of PIPS[value] ?? []) {
    const pip = document.createElementNS(SVG_NS, "circle");
    pip.setAttribute("class", "die__pip");
    pip.setAttribute("cx", String(6 + column * 6));
    pip.setAttribute("cy", String(6 + row * 6));
    pip.setAttribute("r", "2.1");
    die.append(pip);
  }
  return die;
}
