import type { ReactElement } from 'react';
import { FIELD_COLORS } from '../field/colors';
import { DEFAULT_FIELD, auxCurrent, mainCurrent, resultant } from '../../simulations/field';
import { BAR_COUNT, SENSE, barAngle, barCurrents, barForces, fieldAngle, shaftAngle, type ChainId } from './chain';

// One small drawing per stage of the chain, all in a 200 x 140 box centred on (CX, CY). Angles are mathematical
// (counter-clockwise from +x); `pt` flips y for the screen. The same time `wt` drives every drawing.
const CX = 100;
const CY = 66;
const TAU = 2 * Math.PI;
const COPPER = '#d98b4d';
const RING = 52; // stator bore
const ROTOR = 38;
const BAR_R = 27; // radius of the rotor bars
const BASE = 134; // baseline of the caption / legend row

const pt = (angle: number, r: number) => ({ x: CX + r * Math.cos(angle), y: CY - r * Math.sin(angle) });
type Pt = { x: number; y: number };
const CENTRE: Pt = { x: CX, y: CY };

/** Arrow head with its tip at (x, y), pointing along the unit vector (ux, uy). */
export function Head({ x, y, ux, uy, size = 9, color }: { x: number; y: number; ux: number; uy: number; size?: number; color: string }) {
  const bx = x - ux * size;
  const by = y - uy * size;
  const hx = -uy * size * 0.5;
  const hy = ux * size * 0.5;
  return <path d={`M${x},${y}L${bx + hx},${by + hy}L${bx - hx},${by - hy}Z`} fill={color} stroke={color} strokeWidth={1} strokeLinejoin="round" />;
}

function Arrow({ from, to, color, dash, w = 3.5 }: { from: Pt; to: Pt; color: string; dash?: string; w?: number }) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 4) return <circle cx={from.x} cy={from.y} r={w * 0.9} fill={color} />; // a zero-length vector is still drawn
  const ux = dx / len;
  const uy = dy / len;
  const h = Math.min(9, len * 0.6);
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x - ux * h} y2={to.y - uy * h} stroke={color} strokeWidth={w} strokeLinecap="round" strokeDasharray={dash} />
      <Head x={to.x} y={to.y} ux={ux} uy={uy} size={h} color={color} />
    </g>
  );
}

/** Arc of radius r from angle `from`, `span` radians long, turning in `sense` (+1 counter-clockwise), with an arrow head at the end. */
function CurvedArrow({ r, from, span, sense, color, w = 3 }: { r: number; from: number; span: number; sense: 1 | -1; color: string; w?: number }) {
  const a = pt(from, r);
  const endAngle = from + sense * span;
  const b = pt(endAngle, r);
  const ux = -sense * Math.sin(endAngle); // tangent at the end, in screen coordinates
  const uy = -sense * Math.cos(endAngle);
  return (
    <g>
      <path d={`M${a.x},${a.y}A${r},${r} 0 ${span > Math.PI ? 1 : 0} ${sense === 1 ? 0 : 1} ${b.x},${b.y}`} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" />
      <Head x={b.x} y={b.y} ux={ux} uy={uy} size={8} color={color} />
    </g>
  );
}

/** Current in a bar: dot = out of the page, cross = into the page; the size follows the size of the current. */
function BarMark({ x, y, i }: { x: number; y: number; i: number }) {
  const a = Math.abs(i);
  if (a < 0.12) return <circle cx={x} cy={y} r={3} className="cg-bar" />; // no current at this instant
  const r = 3.5 + 4.5 * a;
  const k = r * 0.6;
  return (
    <g>
      <circle cx={x} cy={y} r={r} className="cg-bar cg-bar-live" />
      {i > 0 ? (
        <circle cx={x} cy={y} r={r * 0.38} className="cg-fill-ink" />
      ) : (
        <path d={`M${x - k},${y - k}L${x + k},${y + k}M${x - k},${y + k}L${x + k},${y - k}`} className="cg-stroke-ink" fill="none" strokeWidth={2} strokeLinecap="round" />
      )}
    </g>
  );
}

const Stator = () => <circle className="cg-ring" cx={CX} cy={CY} r={RING} />;
const Rotor = () => <circle className="cg-rotor" cx={CX} cy={CY} r={ROTOR} />;
const Caption = ({ children }: { children: string }) => (
  <text className="cg-txt cg-dim" x={CX} y={BASE} textAnchor="middle">
    {children}
  </text>
);

interface G {
  wt: number;
}

function Supply({ wt }: G) {
  const x0 = 16;
  const w = 168;
  const amp = 36;
  const y0 = 62;
  const n = 60;
  const pts = Array.from({ length: n + 1 }, (_, i) => `${x0 + (w * i) / n},${y0 - amp * Math.sin((TAU * i) / n)}`).join(' ');
  const u = ((wt % TAU) + TAU) % TAU;
  return (
    <g>
      <line className="cg-axis" x1={x0 - 4} y1={y0} x2={x0 + w + 4} y2={y0} />
      <polyline className="cg-wave" points={pts} />
      <circle className="cg-dot" cx={x0 + (w * u) / TAU} cy={y0 - amp * Math.sin(u)} r={5.5} />
      <text className="cg-txt" x={x0} y={14}>
        v(t)
      </text>
      <Caption>for example 120 V, 60 Hz</Caption>
    </g>
  );
}

function Windings({ wt }: G) {
  const im = mainCurrent(DEFAULT_FIELD, wt);
  const ia = auxCurrent(DEFAULT_FIELD, wt);
  const L = 38;
  // coil sides sit in the stator slots; the long side of each runs along the circle
  const coil = (deg: number, color: string) => {
    const p = pt((deg * Math.PI) / 180, RING - 5);
    return <rect key={deg} x={p.x - 6} y={p.y - 13} width={12} height={26} rx={3} transform={`rotate(${-deg} ${p.x} ${p.y})`} fill={COPPER} stroke={color} strokeWidth={2.5} />;
  };
  return (
    <g>
      <Stator />
      {coil(0, FIELD_COLORS.main)}
      {coil(180, FIELD_COLORS.main)}
      {coil(90, FIELD_COLORS.aux)}
      {coil(270, FIELD_COLORS.aux)}
      <Arrow from={CENTRE} to={{ x: CX + L * im, y: CY }} color={FIELD_COLORS.main} />
      <Arrow from={CENTRE} to={{ x: CX, y: CY - L * ia }} color={FIELD_COLORS.aux} dash="6 4" />
      <g className="cg-txt">
        <line x1={22} y1={BASE - 4} x2={46} y2={BASE - 4} stroke={FIELD_COLORS.main} strokeWidth={3.5} />
        <text x={52} y={BASE}>
          main
        </text>
        <line x1={104} y1={BASE - 4} x2={128} y2={BASE - 4} stroke={FIELD_COLORS.aux} strokeWidth={3.5} strokeDasharray="6 4" />
        <text x={134} y={BASE}>
          auxiliary
        </text>
      </g>
    </g>
  );
}

function Field({ wt }: G) {
  const R = 40;
  const at = (t: number) => {
    const q = resultant(DEFAULT_FIELD, t);
    return { x: CX + R * q.x, y: CY - R * q.y };
  };
  const tip = at(wt);
  return (
    <g>
      <Stator />
      <circle className="cg-orbit" cx={CX} cy={CY} r={R} />
      <line className="cg-guide" x1={tip.x} y1={tip.y} x2={tip.x} y2={CY} />
      <line className="cg-guide" x1={tip.x} y1={tip.y} x2={CX} y2={tip.y} />
      {[1, 2, 3, 4, 5, 6].map((k) => {
        const q = at(wt - k * 0.22); // where the tip was a moment ago
        return <circle key={k} cx={q.x} cy={q.y} r={3.6 - k * 0.45} fill={FIELD_COLORS.res} opacity={0.75 - k * 0.1} />;
      })}
      <Arrow from={CENTRE} to={tip} color={FIELD_COLORS.res} w={4} />
      <Caption>one vector, constant length, turning</Caption>
    </g>
  );
}

function RotorCurrent({ wt }: G) {
  const a = fieldAngle(wt);
  const cur = barCurrents(a);
  return (
    <g>
      <Stator />
      <Rotor />
      <Arrow from={CENTRE} to={pt(a, RING - 4)} color={FIELD_COLORS.res} w={2.2} />
      {cur.map((i, k) => {
        const p = pt(barAngle(k, BAR_COUNT), BAR_R);
        return <BarMark key={k} x={p.x} y={p.y} i={i} />;
      })}
      <Caption>rotor at standstill</Caption>
    </g>
  );
}

function Torque({ wt }: G) {
  const a = fieldAngle(wt);
  const f = barForces(a);
  return (
    <g>
      <Stator />
      <Rotor />
      {f.map((fk, k) => {
        const th = barAngle(k, BAR_COUNT);
        const p = pt(th, BAR_R + 2);
        const len = 28 * Math.abs(fk);
        // the counter-clockwise tangent in screen coordinates is (-sin, -cos); a negative force turns it round
        const ux = -Math.sin(th) * Math.sign(fk);
        const uy = -Math.cos(th) * Math.sign(fk);
        return (
          <g key={k}>
            <circle cx={p.x} cy={p.y} r={3} className="cg-bar cg-bar-live" />
            {len > 4 && <Arrow from={p} to={{ x: p.x + ux * len, y: p.y + uy * len }} color={FIELD_COLORS.fwd} w={3} />}
          </g>
        );
      })}
      <CurvedArrow r={13} from={Math.PI * 0.75} span={Math.PI * 1.4} sense={SENSE} color={FIELD_COLORS.res} />
      <text className="cg-txt" x={CX} y={CY + 4} textAnchor="middle">
        T
      </text>
      <Caption>rotor at standstill</Caption>
    </g>
  );
}

function Shaft({ wt }: G) {
  const b = shaftAngle(wt);
  const a = fieldAngle(wt);
  const end = pt(b, ROTOR - 4);
  return (
    <g>
      <Stator />
      <Rotor />
      {Array.from({ length: BAR_COUNT }, (_, k) => {
        const p = pt(barAngle(k, BAR_COUNT) + b, BAR_R);
        return <circle key={k} cx={p.x} cy={p.y} r={3} className="cg-bar cg-bar-live" />;
      })}
      <line className="cg-mark" x1={CX} y1={CY} x2={end.x} y2={end.y} />
      <circle className="cg-hub" cx={CX} cy={CY} r={7} />
      <Arrow from={CENTRE} to={pt(a, RING - 4)} color={FIELD_COLORS.res} w={2.2} />
      <CurvedArrow r={RING + 9} from={-0.45 * SENSE} span={0.9} sense={SENSE} color={FIELD_COLORS.fwd} />
      <g className="cg-txt">
        <line x1={14} y1={BASE - 4} x2={38} y2={BASE - 4} className="cg-mark" />
        <text x={44} y={BASE}>
          shaft mark
        </text>
        <line x1={118} y1={BASE - 4} x2={142} y2={BASE - 4} stroke={FIELD_COLORS.res} strokeWidth={2.2} />
        <text x={148} y={BASE}>
          field
        </text>
      </g>
    </g>
  );
}

const GLYPHS: Record<ChainId, (p: G) => ReactElement> = { supply: Supply, windings: Windings, field: Field, rotorCurrent: RotorCurrent, torque: Torque, shaft: Shaft };

export function Glyph({ id, wt }: { id: ChainId; wt: number }) {
  const Draw = GLYPHS[id];
  return <Draw wt={wt} />;
}
