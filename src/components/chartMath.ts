// Pure helpers for the SVG charts (kept free of React so they can be unit-tested).

/** "Nice" tick values (1, 2, 2.5, 5 x 10^k) covering [min, max]. Returns [] for non-finite input. */
export function niceTicks(min: number, max: number, target = 6): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  if (min > max) [min, max] = [max, min];
  const raw = (max - min) / Math.max(1, target);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 3.5 ? 2.5 : norm < 7.5 ? 5 : 10) * mag;
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  const out: number[] = [];
  for (let i = first; i <= last; i++) {
    const v = Number((i * step).toPrecision(12));
    out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
  }
  return out;
}

/** Fewest decimals that represent every tick exactly. */
export function tickDecimals(ticks: number[]): number {
  for (let d = 0; d <= 4; d++) {
    if (ticks.every((t) => Math.abs(Number(t.toFixed(d)) - t) < 1e-9 * Math.max(1, Math.abs(t)))) return d;
  }
  return 4;
}

export function formatTick(v: number, decimals: number): string {
  const s = v.toFixed(decimals);
  return Math.abs(v) >= 10000 ? Number(s).toLocaleString('en-US') : s;
}

/** Domain padded outwards to tick boundaries, always finite and non-degenerate. */
export function niceDomain(min: number, max: number, includeZero = false): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const pad = Math.abs(min) > 0 ? Math.abs(min) * 0.1 : 1;
    min -= pad;
    max += pad;
  }
  const t = niceTicks(min, max, 5);
  if (t.length < 2) return [min, max];
  const step = t[1] - t[0];
  return [Math.floor(min / step + 1e-9) * step, Math.ceil(max / step - 1e-9) * step];
}

/** SVG path for the finite points; a run of non-finite values breaks the line instead of drawing a spike. */
export function linePath(points: ReadonlyArray<readonly [number, number]>, sx: (x: number) => number, sy: (y: number) => number): string {
  let d = '';
  let pen = false;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`;
    pen = true;
  }
  return d;
}

export interface LabelSpec {
  x: number;
  /** Text baseline. */
  y: number;
  /** Estimated text width in px. */
  w: number;
  anchor: 'start' | 'end';
  /** Box height in px; the default 13 is one line of chart text (10 above the baseline, 3 below). */
  h?: number;
}

/**
 * Vertical nudges (px) that keep chart labels from overlapping: each label tries its own place first, then up and down in
 * `step` px increments, up to `reach` steps each way. `fixed` labels are obstacles that never move. Labels that fit nowhere
 * stay where they are.
 */
export function declutter(labels: LabelSpec[], fixed: LabelSpec[] = [], bounds: [number, number] = [-Infinity, Infinity], step = 13, reach = 3): number[] {
  const rect = (l: LabelSpec, dy: number) => {
    const x0 = l.anchor === 'end' ? l.x - l.w : l.x;
    return { x0, x1: x0 + l.w, y0: l.y + dy - ((l.h ?? 13) - 3), y1: l.y + dy + 3 };
  };
  type R = ReturnType<typeof rect>;
  const hit = (a: R, b: R) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  const placed: R[] = fixed.map((l) => rect(l, 0));
  const tries = [0];
  for (let n = 1; n <= reach; n++) tries.push(-n, n); // 0, -1, 1, -2, 2, ...: the nearest free place wins
  return labels.map((l) => {
    for (const k of tries) {
      const r = rect(l, k * step);
      if (r.y0 < bounds[0] || r.y1 > bounds[1]) continue;
      if (!placed.some((p) => hit(p, r))) {
        placed.push(r);
        return k * step;
      }
    }
    placed.push(rect(l, 0));
    return 0;
  });
}
