// Geometry helpers for the circuit diagrams (pure, so they can be unit-tested).

export type Kind = 'coil' | 'cap' | 'res' | 'switch';
/** Height of each symbol in the vertical branches [px in diagram units]. */
export const KIND_H: Record<Kind, number> = { coil: 72, cap: 12, res: 44, switch: 44 };

/** Symbols down the auxiliary branch of the simple (one-branch) circuits, top to bottom. */
export const AUX_KINDS = {
  'split-phase': ['switch', 'res', 'coil'],
  'capacitor-start': ['switch', 'cap', 'coil'],
  psc: ['cap', 'coil'],
} as const satisfies Record<string, readonly Kind[]>;

export interface Placed {
  kind: Kind;
  y0: number;
  y1: number;
}
export interface BranchLayout {
  items: Placed[];
  /** Vertical wire pieces [y from, y to] between the rails and the symbols. */
  wires: [number, number][];
}

/** Spread symbols evenly down a vertical branch between two rails. Throws if they do not fit. */
export function layoutBranch(kinds: readonly Kind[], yTop: number, yBottom: number): BranchLayout {
  const total = kinds.reduce((a, k) => a + KIND_H[k], 0);
  const gap = (yBottom - yTop - total) / (kinds.length + 1);
  if (gap < 6) throw new RangeError('Symbols do not fit in the branch.');
  const items: Placed[] = [];
  const wires: [number, number][] = [];
  let y = yTop + gap;
  let prev = yTop;
  for (const kind of kinds) {
    wires.push([prev, y]);
    items.push({ kind, y0: y, y1: y + KIND_H[kind] });
    prev = y + KIND_H[kind];
    y += KIND_H[kind] + gap;
  }
  wires.push([prev, yBottom]);
  return { items, wires };
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
export interface Pt {
  x: number;
  y: number;
}

/**
 * Dots that slosh back and forth along a wire, standing for alternating current: every dot sits in its own cell and moves
 * `amp * sin(phase)` along the wire, never leaving the cell. The amplitude stands for the size of the current.
 */
export function sloshDots(seg: Seg, spacing: number, amp: number, phase: number): Pt[] {
  const len = Math.hypot(seg.x2 - seg.x1, seg.y2 - seg.y1);
  if (len < 8) return [];
  const n = Math.max(1, Math.floor(len / spacing));
  const step = len / n;
  const ux = (seg.x2 - seg.x1) / len;
  const uy = (seg.y2 - seg.y1) / len;
  const a = Math.max(0, Math.min(amp, step / 2 - 2));
  const d = a * Math.sin(phase);
  return Array.from({ length: n }, (_, k) => {
    const s = (k + 0.5) * step + d;
    return { x: seg.x1 + ux * s, y: seg.y1 + uy * s };
  });
}

/** Screen position of a phasor of length `r` at `deg` degrees counter-clockwise from the +x axis (SVG y points down). */
export const polar = (cx: number, cy: number, r: number, deg: number): Pt => ({
  x: cx + r * Math.cos((deg * Math.PI) / 180),
  y: cy - r * Math.sin((deg * Math.PI) / 180),
});

/** Angle from phasor A to phasor B in degrees, wrapped to (-180, 180]. */
export const angleBetween = (aDeg: number, bDeg: number): number => {
  const d = ((((bDeg - aDeg) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
};
