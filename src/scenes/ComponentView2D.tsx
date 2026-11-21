// 2D cut-away side view of the same motor: the fallback when WebGL is unavailable, and a quiet alternative view.
// Same selection / explode / isolate / context behaviour as the 3D scene. Hatching (not just colour) tells parts apart.
import type { KeyboardEvent, ReactNode } from 'react';
import { COMPONENTS, COMPONENT_BY_ID } from '../content/components';
import { explodeOffset, type PartId } from './layout';
import type { SceneState } from './parts';

type State2D = Omit<SceneState, 'angle'>;
const U = 100; // px per model unit
const NUMBER: Record<string, number> = Object.fromEntries(COMPONENTS.map((c, i) => [c.id, i + 1]));

/** Rectangle from model-space corners (y up) to SVG attributes. */
const r = (x0: number, y0: number, x1: number, y1: number) => ({ x: x0 * U, y: -y1 * U, width: (x1 - x0) * U, height: (y1 - y0) * U });
const mirrorY = (y0: number, y1: number): [number, number] => [-y1, -y0];

interface PartGProps {
  id: PartId;
  slot?: 'de' | 'nde';
  s: State2D;
  /** [anchor x, anchor y, badge x, badge y] in assembled coordinates, relative to the part. */
  badge?: [number, number, number, number];
  children: ReactNode;
}

function PartG({ id, slot, s, badge, children }: PartGProps) {
  if (s.isolated && s.isolated !== id) return null;
  const key = slot ? `${id}:${slot}` : id;
  const [dx, dy, dz] = explodeOffset(key, s.explode);
  const dyShown = dy - (id === 'auxWinding' ? Math.abs(dz) * 0.35 : 0); // main/aux windings separate vertically in this view
  const selected = s.selected === id;
  const seeThrough = id === 'housing' && s.housingTransparent; // must not swallow clicks meant for the parts inside
  const ghost = seeThrough || (s.context !== null && s.context !== id);
  const info = COMPONENT_BY_ID[id];
  const choose = () => s.onSelect(id);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose();
    }
  };
  return (
    <g
      className={`p2d${selected ? ' sel' : ''}${s.hovered === id ? ' hov' : ''}${ghost ? ' ghost' : ''}${seeThrough ? ' noevents' : ''}`}
      transform={`translate(${dx * U} ${-dyShown * U})`}
      role="button"
      tabIndex={0}
      aria-label={`${info.name}${slot ? (slot === 'de' ? ' (drive end)' : ' (non-drive end)') : ''}`}
      aria-pressed={selected}
      onClick={(e) => {
        e.stopPropagation();
        choose();
      }}
      onKeyDown={onKey}
      onMouseEnter={() => s.onHover(id)}
      onMouseLeave={() => s.onHover(null)}
      onFocus={() => s.onHover(id)}
      onBlur={() => s.onHover(null)}
    >
      <title>{info.name}</title>
      {children}
      {s.showLabels && badge && (
        <g className="badge2d" aria-hidden="true">
          <line x1={badge[0] * U} y1={-badge[1] * U} x2={badge[2] * U} y2={-badge[3] * U} />
          <circle cx={badge[2] * U} cy={-badge[3] * U} r={11} />
          <text x={badge[2] * U} y={-badge[3] * U + 4} textAnchor="middle">
            {NUMBER[id]}
          </text>
        </g>
      )}
    </g>
  );
}

/** Mirrored top/bottom pair of rectangles (the cut-away is symmetric about the shaft axis). */
function Pair({ x0, y0, x1, y1, className, fill }: { x0: number; y0: number; x1: number; y1: number; className?: string; fill: string }) {
  const [m0, m1] = mirrorY(y0, y1);
  return (
    <>
      <rect className={`sh ${className ?? ''}`} {...r(x0, y0, x1, y1)} fill={fill} />
      <rect className={`sh ${className ?? ''}`} {...r(x0, m0, x1, m1)} fill={fill} />
    </>
  );
}

export default function ComponentView2D({ state: s }: { state: State2D }) {
  const e = Math.min(Math.max(s.explode, 0), 1.3);
  // Frame the drawing: lerp between the assembled and fully exploded bounding boxes.
  const lerp = (a: number, b: number) => a + (b - a) * Math.min(e, 1);
  const x0 = lerp(-2.7, -6.2) * U;
  const x1 = lerp(3.3, 6.0) * U;
  const y0 = -lerp(2.15, 5.2) * U;
  const y1 = lerp(1.65, 3.0) * U;
  const vb = `${x0} ${y0} ${x1 - x0} ${y1 - y0}`;
  const lidLift = 0.55 * Math.min(1.5, Math.max(0, (s.explode - 0.45) / 0.55));

  return (
    <svg className="view2d" viewBox={vb} role="group" aria-label="Two-dimensional cut-away view of the motor. Each component is a button." onClick={() => s.onSelect(null)}>
      <defs>
        <pattern id="h-lam" width="12.5" height="10" patternUnits="userSpaceOnUse">
          <rect width="12.5" height="10" fill="#8b99aa" />
          <line x1="1" x2="1" y1="0" y2="10" stroke="#4d5a6b" strokeWidth="1.4" />
        </pattern>
        <pattern id="h-main" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#e0872a" />
          <line x1="0" x2="0" y1="0" y2="8" stroke="#7a4410" strokeWidth="2.2" />
        </pattern>
        <pattern id="h-aux" width="7" height="7" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="#38b6e0" />
          <circle cx="3.5" cy="3.5" r="1.4" fill="#0c4f66" />
        </pattern>
        <pattern id="h-bar" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <rect width="9" height="9" fill="#6c7a8d" />
          <line x1="0" x2="0" y1="0" y2="9" stroke="#3f4958" strokeWidth="1.6" />
        </pattern>
      </defs>

      {/* shaft axis */}
      <line className="axis2d" x1={-6.4 * U} x2={6.4 * U} y1={0} y2={0} />

      <PartG id="housing" s={s} badge={[0.8, 1.04, 1.1, 1.55]}>
        <Pair x0={-0.95} y0={0.93} x1={0.95} y1={1.05} fill="#5f7083" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} className="sh" {...r(-0.88 + i * 0.195, 1.05, -0.83 + i * 0.195, 1.12)} fill="#56677a" />
        ))}
        <rect className="sh" {...r(-0.68, -1.15, 0.68, -1.05)} fill="#4c5c6e" />
      </PartG>

      <PartG id="stator" s={s} badge={[0.55, 0.82, 0.62, 1.78]}>
        <Pair x0={-0.75} y0={0.55} x1={0.75} y1={0.9} fill="url(#h-lam)" />
      </PartG>

      <PartG id="mainWinding" s={s} badge={[0.3, 0.68, -0.3, 1.78]}>
        <Pair x0={-0.75} y0={0.62} x1={0.75} y1={0.72} fill="url(#h-main)" />
        {[-1, 1].map((sx) => (
          <g key={sx}>
            <ellipse className="sh" cx={sx * 0.85 * U} cy={-0.67 * U} rx={0.13 * U} ry={0.14 * U} fill="url(#h-main)" />
            <ellipse className="sh" cx={sx * 0.85 * U} cy={0.67 * U} rx={0.13 * U} ry={0.14 * U} fill="url(#h-main)" />
          </g>
        ))}
      </PartG>

      <PartG id="auxWinding" s={s} badge={[-0.3, 0.585, -0.78, -1.78]}>
        <Pair x0={-0.75} y0={0.55} x1={0.75} y1={0.62} fill="url(#h-aux)" />
        {[-1, 1].map((sx) => (
          <g key={sx}>
            <ellipse className="sh" cx={sx * 0.92 * U} cy={-0.6 * U} rx={0.07 * U} ry={0.1 * U} fill="url(#h-aux)" />
            <ellipse className="sh" cx={sx * 0.92 * U} cy={0.6 * U} rx={0.07 * U} ry={0.1 * U} fill="url(#h-aux)" />
          </g>
        ))}
      </PartG>

      <PartG id="airGap" s={s} badge={[0.1, -0.525, 0.25, -1.78]}>
        <Pair x0={-0.75} y0={0.5} x1={0.75} y1={0.55} className="gap" fill="rgba(61,224,255,0.45)" />
      </PartG>

      <PartG id="rotor" s={s} badge={[0.2, -0.2, 0.9, -1.78]}>
        <rect className="sh" {...r(-0.75, -0.5, 0.75, 0.5)} fill="#6c7a8d" />
        <Pair x0={-0.8} y0={0.42} x1={0.8} y1={0.5} fill="url(#h-bar)" />
        <rect className="sh" {...r(-0.84, -0.5, -0.76, 0.5)} fill="#dfe5ec" />
        <rect className="sh" {...r(0.76, -0.5, 0.84, 0.5)} fill="#dfe5ec" />
      </PartG>

      <PartG id="shaft" s={s} badge={[2.2, 0.1, 2.5, 0.75]}>
        <rect className="sh" {...r(-1.875, -0.12, 2.425, 0.12)} fill="#b3bcc8" />
        <rect className="sh" {...r(1.85, 0.12, 2.35, 0.17)} fill="#323a44" />
      </PartG>

      <PartG id="bearings" slot="de" s={s} badge={[1.12, -0.2, 1.4, -1.0]}>
        <Pair x0={1.04} y0={0.12} x1={1.2} y1={0.27} fill="#cbd2db" />
      </PartG>
      <PartG id="bearings" slot="nde" s={s}>
        <Pair x0={-1.2} y0={0.12} x1={-1.04} y1={0.27} fill="#cbd2db" />
      </PartG>

      <PartG id="endShields" slot="de" s={s} badge={[1.05, -0.8, 1.7, -1.4]}>
        <Pair x0={0.95} y0={0.27} x1={1.15} y1={1.0} fill="#4f6075" />
        <Pair x0={1.15} y0={0.27} x1={1.35} y1={0.4} fill="#4f6075" />
      </PartG>
      <PartG id="endShields" slot="nde" s={s}>
        <Pair x0={-1.15} y0={0.27} x1={-0.95} y1={1.0} fill="#4f6075" />
        <Pair x0={-1.35} y0={0.27} x1={-1.15} y1={0.4} fill="#4f6075" />
      </PartG>

      <PartG id="fan" s={s} badge={[-1.55, -0.4, -1.5, -1.4]}>
        <rect className="sh" {...r(-1.63, -0.17, -1.47, 0.17)} fill="#8c99a8" />
        <Pair x0={-1.6} y0={0.17} x1={-1.5} y1={0.58} fill="#4d9bd8" />
      </PartG>

      <PartG id="fanCover" s={s} badge={[-2.0, 0.6, -2.0, 1.6]}>
        <path className="sh" d={`M ${-1.0 * U} ${-1.0 * U} H ${-2.0 * U} V ${1.0 * U} H ${-1.0 * U}`} fill="rgba(58,72,89,0.25)" strokeWidth={3} />
        {Array.from({ length: 9 }, (_, i) => (
          <line key={i} className="sh" x1={-2.0 * U} x2={-2.0 * U} y1={(-0.9 + i * 0.225) * U} y2={(-0.9 + i * 0.225 + 0.1) * U} strokeWidth={5} />
        ))}
      </PartG>

      <PartG id="terminalBox" s={s} badge={[0.45, 1.3, 0.62, 1.78]}>
        <rect className="sh" {...r(0.175, 1.06, 0.725, 1.34)} fill="#44566b" />
        <rect className="sh" {...r(0.15, 1.34 + lidLift, 0.75, 1.39 + lidLift)} fill="#566a82" />
      </PartG>

      <PartG id="capacitor" s={s} badge={[-0.35, 1.47, -0.5, 1.78]}>
        <rect className="sh" {...r(-0.75, 1.07, 0.05, 1.47)} rx={14} fill="#1d3f73" />
        <rect className="sh" {...r(-0.55, 1.07, -0.33, 1.47)} fill="#e9eef5" />
        <rect className="sh" {...r(0.05, 1.22, 0.14, 1.32)} fill="#d8a53c" />
      </PartG>

      <PartG id="centrifugalSwitch" s={s} badge={[-0.9, -0.3, -1.2, -1.0]}>
        <rect className="sh" {...r(-0.93, -0.19, -0.83, 0.19)} fill="#c9a227" />
        <Pair x0={-0.91} y0={0.19} x1={-0.85} y1={0.34} fill="#d6d9de" />
        <rect className="sh" {...r(-0.96, 0.24, -0.93, 0.6)} fill="#5b3a22" />
      </PartG>
    </svg>
  );
}
