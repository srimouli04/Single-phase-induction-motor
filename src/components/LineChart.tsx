import { useEffect, useId, useRef, useState } from 'react';
import { declutter, formatTick, linePath, niceDomain, niceTicks, tickDecimals, type LabelSpec } from './chartMath';

export interface Series {
  id: string;
  label: string;
  points: ReadonlyArray<readonly [number, number]>;
  color: string;
  /** SVG dash pattern. Series must differ by dash / width as well as colour (colour-independent encoding). */
  dash?: string;
  width?: number;
}
export interface PointMarker {
  x: number;
  y: number;
  label: string;
  color: string;
  shape?: 'circle' | 'diamond' | 'square';
}
export interface RefLine {
  value: number;
  label: string;
  color?: string;
  dash?: string;
}
export interface Band {
  from: number;
  to: number;
  label: string;
}

export interface LineChartProps {
  title: string;
  /** Text alternative describing what the chart shows (read by screen readers). */
  desc?: string;
  series: Series[];
  markers?: PointMarker[];
  vLines?: RefLine[];
  hLines?: RefLine[];
  /** X ranges that are drawn hatched (e.g. outside the modelled range). */
  bands?: Band[];
  xLabel: string;
  yLabel: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  includeZeroY?: boolean;
  height?: number;
  /** Moving cursor (time marker). */
  cursorX?: number;
}

function useElementWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.max(260, el.clientWidth || fallback));
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

const MARGIN = { t: 16, r: 18, b: 48, l: 58 };

function Shape({ shape = 'circle', x, y, color, size = 5.5 }: { shape?: PointMarker['shape']; x: number; y: number; color: string; size?: number }) {
  const common = { fill: color, stroke: 'var(--bg)', strokeWidth: 1.5 };
  if (shape === 'square') return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} {...common} />;
  if (shape === 'diamond') return <path d={`M${x},${y - size * 1.3}L${x + size * 1.3},${y}L${x},${y + size * 1.3}L${x - size * 1.3},${y}Z`} {...common} />;
  return <circle cx={x} cy={y} r={size} {...common} />;
}

export function LineChart({ title, desc, series, markers = [], vLines = [], hLines = [], bands = [], xLabel, yLabel, xDomain, yDomain, includeZeroY, height = 300, cursorX }: LineChartProps) {
  const uid = useId().replace(/:/g, '');
  const [ref, width] = useElementWidth<HTMLDivElement>(560);
  const pw = Math.max(60, width - MARGIN.l - MARGIN.r);
  const ph = Math.max(60, height - MARGIN.t - MARGIN.b);

  const xs: number[] = [];
  const ys: number[] = [];
  for (const s of series) {
    for (const [x, y] of s.points) {
      if (Number.isFinite(x)) xs.push(x);
      if (Number.isFinite(y)) ys.push(y);
    }
  }
  const [x0, x1] = xDomain ?? niceDomain(Math.min(...xs), Math.max(...xs));
  const [y0, y1] = yDomain ?? niceDomain(Math.min(...ys), Math.max(...ys), includeZeroY);
  const sx = (x: number) => MARGIN.l + ((x - x0) / (x1 - x0 || 1)) * pw;
  const sy = (y: number) => MARGIN.t + ph - ((y - y0) / (y1 - y0 || 1)) * ph;
  const xt = niceTicks(x0, x1, Math.max(3, Math.floor(pw / 90)));
  const yt = niceTicks(y0, y1, Math.max(3, Math.floor(ph / 50)));
  const xd = tickDecimals(xt);
  const yd = tickDecimals(yt);
  const halo = { paintOrder: 'stroke' as const, stroke: 'var(--bg-panel)', strokeWidth: 3.5, strokeLinejoin: 'round' as const };
  const clipId = `clip-${uid}`;
  const hatchId = `hatch-${uid}`;

  // Labels for markers and horizontal lines are nudged apart; the (staggered) vertical-line labels are fixed obstacles.
  const CH = 6.2; // average glyph width of the 11 px chart font
  const vis = markers.filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && m.x >= x0 && m.x <= x1 && m.y >= y0 && m.y <= y1); // markers outside the plot are not drawn (they would float over the next chart)
  const right = (x: number) => x > MARGIN.l + pw * 0.75;
  const mSpecs: LabelSpec[] = vis.map((m) => ({ x: sx(m.x) + (right(sx(m.x)) ? -10 : 10), y: sy(m.y) - 9, w: m.label.length * CH, anchor: right(sx(m.x)) ? 'end' : 'start' }));
  const hSpecs: LabelSpec[] = hLines.map((l) => ({ x: MARGIN.l + pw - 5, y: sy(l.value) - 5, w: l.label.length * CH, anchor: 'end' }));
  const vSpecs: LabelSpec[] = vLines.map((l, i) => {
    const end = sx(l.value) > MARGIN.l + pw * 0.7;
    return { x: sx(l.value) + (end ? -5 : 5), y: MARGIN.t + 12 + (i % 3) * 13, w: l.label.length * CH, anchor: end ? 'end' : 'start' };
  });
  const nudge = declutter([...mSpecs, ...hSpecs], vSpecs, [MARGIN.t + 10, MARGIN.t + ph - 2], 17); // 17 px: a label moved down from "just above its line" clears that line

  return (
    <figure className="chart" ref={ref}>
      <figcaption>{title}</figcaption>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`t-${uid} d-${uid}`}>
        <title id={`t-${uid}`}>{title}</title>
        <desc id={`d-${uid}`}>{desc ?? `${title}. X axis: ${xLabel}. Y axis: ${yLabel}.`}</desc>
        <defs>
          <clipPath id={clipId}>
            <rect x={MARGIN.l} y={MARGIN.t} width={pw} height={ph} />
          </clipPath>
          <pattern id={hatchId} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="var(--muted)" strokeWidth="1.4" opacity="0.45" />
          </pattern>
        </defs>

        {yt.map((t) => (
          <g key={`y${t}`}>
            <line x1={MARGIN.l} x2={MARGIN.l + pw} y1={sy(t)} y2={sy(t)} className={t === 0 ? 'ch-zero' : 'ch-grid'} />
            <text x={MARGIN.l - 8} y={sy(t) + 4} textAnchor="end" className="ch-tick">
              {formatTick(t, yd)}
            </text>
          </g>
        ))}
        {xt.map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={MARGIN.t} y2={MARGIN.t + ph} className={t === 0 ? 'ch-zero' : 'ch-grid'} />
            <text x={sx(t)} y={MARGIN.t + ph + 16} textAnchor="middle" className="ch-tick">
              {formatTick(t, xd)}
            </text>
          </g>
        ))}
        <rect x={MARGIN.l} y={MARGIN.t} width={pw} height={ph} className="ch-frame" />

        <g clipPath={`url(#${clipId})`}>
          {bands.map((b) => (
            <rect key={`${b.label}@${b.from}`} x={sx(Math.max(b.from, x0))} y={MARGIN.t} width={Math.max(0, sx(Math.min(b.to, x1)) - sx(Math.max(b.from, x0)))} height={ph} fill={`url(#${hatchId})`} />
          ))}
          {series.map((s) => (
            <path key={s.id} d={linePath(s.points, sx, sy)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hLines.map((l) => (
            <line key={l.label} x1={MARGIN.l} x2={MARGIN.l + pw} y1={sy(l.value)} y2={sy(l.value)} stroke={l.color ?? 'var(--muted)'} strokeWidth={1.6} strokeDasharray={l.dash ?? '2 4'} />
          ))}
          {vLines.map((l) => (
            <line key={l.label} x1={sx(l.value)} x2={sx(l.value)} y1={MARGIN.t} y2={MARGIN.t + ph} stroke={l.color ?? 'var(--muted)'} strokeWidth={1.6} strokeDasharray={l.dash ?? '6 4'} />
          ))}
          {cursorX !== undefined && Number.isFinite(cursorX) && <line x1={sx(cursorX)} x2={sx(cursorX)} y1={MARGIN.t} y2={MARGIN.t + ph} className="ch-cursor" />}
        </g>

        {bands
          .filter((b, i) => bands.findIndex((o) => o.label === b.label) === i) // a label once, however many bands share it (e.g. a switch that keeps re-closing)
          .map((b, i) => (
            <text key={`bt${b.label}`} x={sx(Math.max(b.from, x0)) + 6} y={MARGIN.t + ph - 8 - i * 13} className="ch-note" {...halo}>
              {b.label}
            </text>
          ))}
        {vLines.map((l, i) => {
          const x = sx(l.value);
          const anchor = x > MARGIN.l + pw * 0.7 ? 'end' : 'start';
          return (
            <text key={`vl${l.label}`} x={x + (anchor === 'end' ? -5 : 5)} y={MARGIN.t + 12 + (i % 3) * 13} textAnchor={anchor} className="ch-note" fill={l.color ?? 'var(--muted)'} {...halo}>
              {l.label}
            </text>
          );
        })}
        {hLines.map((l, i) => (
          <text key={`hl${l.label}`} x={hSpecs[i].x} y={hSpecs[i].y + nudge[mSpecs.length + i]} textAnchor="end" className="ch-note" fill={l.color ?? 'var(--muted)'} {...halo}>
            {l.label}
          </text>
        ))}
        {vis.map((m, i) => (
          <g key={m.label}>
            <Shape shape={m.shape} x={sx(m.x)} y={sy(m.y)} color={m.color} />
            <text x={mSpecs[i].x} y={mSpecs[i].y + nudge[i]} textAnchor={mSpecs[i].anchor} className="ch-note" fill="var(--text)" {...halo}>
              {m.label}
            </text>
          </g>
        ))}

        <text x={MARGIN.l + pw / 2} y={height - 6} textAnchor="middle" className="ch-label">
          {xLabel}
        </text>
        <text transform={`translate(14 ${MARGIN.t + ph / 2}) rotate(-90)`} textAnchor="middle" className="ch-label">
          {yLabel}
        </text>
      </svg>
      <ul className="legend">
        {series.map((s) => (
          <li key={s.id}>
            <svg width="34" height="10" aria-hidden="true">
              <line x1="1" x2="33" y1="5" y2="5" stroke={s.color} strokeWidth={(s.width ?? 2) + 0.5} strokeDasharray={s.dash} strokeLinecap="round" />
            </svg>
            {s.label}
          </li>
        ))}
        {vis.map((m) => (
          <li key={`m${m.label}`}>
            <svg width="14" height="14" aria-hidden="true">
              <Shape shape={m.shape} x={7} y={7} color={m.color} size={4.5} />
            </svg>
            {m.label}
          </li>
        ))}
      </ul>
    </figure>
  );
}
