import { useId, useRef, type ReactNode } from 'react';
import { fmt } from '../../components/format';
import type { MethodId, PartKey } from '../../content/startingMethods';
import type { Complex } from '../../simulations/complex';
import { Part } from './Part';
import { AUX_KINDS, KIND_H, angleBetween, layoutBranch, polar, sloshDots, type Seg } from './circuits';
import { useClock } from '../../hooks/useClock';

export interface Currents {
  main: number;
  aux: number;
  /** Time-phase angle by which the auxiliary current leads the main current [deg]. */
  leadDeg: number;
}
export interface CircuitValues {
  voltage: number;
  frequencyHz: number;
  startUF: number;
  runUF: number;
  auxR: number;
}
export type CircuitMethod = Exclude<MethodId, 'shaded-pole'>;

interface Props {
  method: CircuitMethod;
  /** Start circuit connected. Ignored for PSC, which has no switch. */
  closed: boolean;
  /** Branch currents that drive the animation; null draws the circuit without current. */
  currents: Currents | null;
  values: CircuitValues;
  selected: PartKey | null;
  onSelect: (k: PartKey | null) => void;
}

const W = 680;
const H = 340;
const TOP = 46;
const BOT = 300;
const SRC = { x: 78, y: 173, r: 28 };
const MAIN_X = 250;
const AUX_X = 470;
const SPACING = 15;
const MAX_AMP = 7;
const CH = 6.9; // average glyph width of the 13 px label font

const vseg = (x: number, [y1, y2]: [number, number]): Seg => ({ x1: x, y1, x2: x, y2 });
const diamond = (x: number, y: number, r = 4.6) => `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
const vpath = (x: number, wires: [number, number][]) => wires.map(([a, b]) => `M${x},${a}V${b}`).join('');

// ---------------------------------------------------------------- symbols

const Coil = ({ x, y0 }: { x: number; y0: number }) => <path className="sym" d={`M${x},${y0}${'a9,9 0 0 1 0,18'.repeat(4)}`} />;
const Cap = ({ x, y0 }: { x: number; y0: number }) => (
  <path className="sym" d={`M${x},${y0}V${y0 + 3}M${x - 16},${y0 + 3}H${x + 16}M${x - 16},${y0 + 9}H${x + 16}M${x},${y0 + 9}V${y0 + 12}`} />
);
const Res = ({ x, y0 }: { x: number; y0: number }) => <path className="sym" d={`M${x},${y0}v6l9,4l-18,8l18,8l-18,8l9,4v6`} />;
function Switch({ x, y0, closed }: { x: number; y0: number; closed: boolean }) {
  const y1 = y0 + KIND_H.switch;
  const pivot = y0 + 6;
  const contact = y1 - 6;
  return (
    <g className="sym">
      <path d={`M${x},${y0}V${pivot}M${x},${contact}V${y1}`} />
      <circle className="node" cx={x} cy={pivot} r={3.2} />
      <circle className="node" cx={x} cy={contact} r={3.2} />
      <line className="blade" x1={x} y1={pivot} x2={x} y2={contact} style={{ transformOrigin: `${x}px ${pivot}px`, transform: `rotate(${closed ? 0 : -26}deg)` }} />
    </g>
  );
}

// ---------------------------------------------------------------- the diagram

export function CircuitDiagram({ method, closed, currents, values, selected, onSelect }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const phase = useClock(ref);
  const v = values;
  const switched = method !== 'psc';
  const open = switched && !closed;

  const mainLay = layoutBranch(['coil'], TOP, BOT);
  const mainCoil = mainLay.items[0];
  const nodes: ReactNode[] = [];
  const auxSegs: { seg: Seg; share: number }[] = [];
  const junctions: [number, number][] = [
    [MAIN_X, TOP],
    [MAIN_X, BOT],
    [AUX_X, TOP],
    [AUX_X, BOT],
  ];

  const labelBox = (x0: number, y0: number, y1: number, label: string, sub?: string, side: 'right' | 'left' = 'right') => {
    const w = 30 + CH * Math.max(label.length, (sub ?? '').length);
    return side === 'right' ? { x: x0 - 34, y: y0 - 6, w: 34 + w, h: y1 - y0 + 12 } : { x: x0 - w - 8, y: y0 - 6, w: w + 8 + 34, h: y1 - y0 + 12 };
  };
  const at = (x: number, y0: number, y1: number, anchor: 'start' | 'end' = 'start') => ({ x, y: (y0 + y1) / 2 - 3, anchor });

  // ---- main branch
  nodes.push(<path key="mw" className="wire" d={vpath(MAIN_X, mainLay.wires)} />);
  {
    const label = 'Main winding';
    const sub = 'always connected';
    nodes.push(
      <Part key="main" id="main" label={label} sub={sub} box={labelBox(MAIN_X, mainCoil.y0, mainCoil.y1, label, sub)} labelAt={at(MAIN_X + 24, mainCoil.y0, mainCoil.y1)} selected={selected} onSelect={onSelect}>
        <Coil x={MAIN_X} y0={mainCoil.y0} />
      </Part>,
    );
  }

  // ---- auxiliary branch
  if (method !== 'cscr') {
    const lay = layoutBranch(AUX_KINDS[method], TOP, BOT);
    nodes.push(<path key="aw" className="wire" d={vpath(AUX_X, lay.wires)} />);
    lay.wires.forEach((w) => auxSegs.push({ seg: vseg(AUX_X, w), share: 1 }));
    lay.items.forEach((it, i) => {
      const common = { x: AUX_X, y0: it.y0 };
      let id: PartKey;
      let label: string;
      let sub: string;
      let symbol: ReactNode;
      if (it.kind === 'switch') {
        id = 'switch';
        label = 'Centrifugal switch';
        sub = closed ? 'closed' : 'open';
        symbol = <Switch {...common} closed={closed} />;
      } else if (it.kind === 'res') {
        id = 'auxR';
        label = 'Winding resistance';
        sub = `${fmt(v.auxR, 0)} Ω (thin wire)`;
        symbol = <Res {...common} />;
      } else if (it.kind === 'cap') {
        id = method === 'capacitor-start' ? 'startCap' : 'runCap';
        label = method === 'capacitor-start' ? 'Start capacitor' : 'Run capacitor';
        sub = `${fmt(method === 'capacitor-start' ? v.startUF : v.runUF, 0)} µF`;
        symbol = <Cap {...common} />;
      } else {
        id = 'aux';
        label = 'Auxiliary winding';
        sub = !switched ? 'always connected' : closed ? 'connected' : 'disconnected';
        symbol = <Coil {...common} />;
      }
      nodes.push(
        <Part key={`a${i}`} id={id} label={label} sub={sub} box={labelBox(AUX_X, it.y0, it.y1, label, sub)} labelAt={at(AUX_X + 24, it.y0, it.y1)} selected={selected} onSelect={onSelect} dim={open && it.kind !== 'switch'}>
          {symbol}
        </Part>,
      );
    });
  } else {
    // CSCR: run capacitor in parallel with (switch + start capacitor), then the winding
    const J1 = 78;
    const J2 = 196;
    const LX = AUX_X - 42;
    const RX = AUX_X + 42;
    const runY = (J1 + J2) / 2 - KIND_H.cap / 2;
    const swY = 92;
    const swEnd = swY + KIND_H.switch;
    const stY = 152;
    const coilY = 214;
    const coilEnd = coilY + KIND_H.coil;
    const wires = [
      `M${AUX_X},${TOP}V${J1}`,
      `M${LX},${J1}H${RX}`,
      `M${LX},${J1}V${runY}M${LX},${runY + KIND_H.cap}V${J2}`,
      `M${RX},${J1}V${swY}M${RX},${swEnd}V${stY}M${RX},${stY + KIND_H.cap}V${J2}`,
      `M${LX},${J2}H${RX}`,
      `M${AUX_X},${J2}V${coilY}M${AUX_X},${coilEnd}V${BOT}`,
    ];
    nodes.push(<path key="aw" className="wire" d={wires.join('')} />);
    junctions.push([AUX_X, J1], [AUX_X, J2]);
    const total = v.startUF + v.runUF;
    const leftShare = closed ? v.runUF / total : 1;
    const rightShare = closed ? v.startUF / total : 0;
    auxSegs.push(
      { seg: vseg(AUX_X, [TOP, J1]), share: 1 },
      { seg: vseg(AUX_X, [J2, coilY]), share: 1 },
      { seg: vseg(AUX_X, [coilEnd, BOT]), share: 1 },
      { seg: vseg(LX, [J1, runY]), share: leftShare },
      { seg: vseg(LX, [runY + KIND_H.cap, J2]), share: leftShare },
      { seg: vseg(RX, [J1, swY]), share: rightShare },
      { seg: vseg(RX, [swEnd, stY]), share: rightShare },
      { seg: vseg(RX, [stY + KIND_H.cap, J2]), share: rightShare },
    );
    const runLabel = 'Run capacitor';
    const runSub = `${fmt(v.runUF, 0)} µF`;
    nodes.push(
      <Part key="run" id="runCap" label={runLabel} sub={runSub} box={labelBox(LX - 22, runY, runY + KIND_H.cap, runLabel, runSub, 'left')} labelAt={at(LX - 22, runY, runY + KIND_H.cap, 'end')} selected={selected} onSelect={onSelect}>
        <Cap x={LX} y0={runY} />
      </Part>,
      <Part key="sw" id="switch" label="Centrifugal switch" sub={closed ? 'closed' : 'open'} box={labelBox(RX, swY, swEnd, 'Centrifugal switch', 'closed')} labelAt={at(RX + 24, swY, swEnd)} selected={selected} onSelect={onSelect}>
        <Switch x={RX} y0={swY} closed={closed} />
      </Part>,
      <Part key="st" id="startCap" label="Start capacitor" sub={`${fmt(v.startUF, 0)} µF`} box={labelBox(RX, stY, stY + KIND_H.cap, 'Start capacitor', '000 µF')} labelAt={at(RX + 24, stY, stY + KIND_H.cap)} selected={selected} onSelect={onSelect} dim={open}>
        <Cap x={RX} y0={stY} />
      </Part>,
      <Part key="ac" id="aux" label="Auxiliary winding" sub="always connected" box={labelBox(AUX_X, coilY, coilEnd, 'Auxiliary winding', 'always connected')} labelAt={at(AUX_X + 24, coilY, coilEnd)} selected={selected} onSelect={onSelect}>
        <Coil x={AUX_X} y0={coilY} />
      </Part>,
    );
  }

  // ---- sloshing dots: the swing stands for the size of the current, the phase shift between the branches for the lead
  const dots: ReactNode[] = [];
  if (currents) {
    const ref0 = Math.max(currents.main, currents.aux, 1e-9);
    const amp = (i: number) => 1.5 + (MAX_AMP - 1.5) * Math.min(1, i / ref0);
    if (currents.main > 1e-9) {
      mainLay.wires.forEach((w, k) =>
        sloshDots(vseg(MAIN_X, w), SPACING, amp(currents.main), phase).forEach((p, i) => dots.push(<circle key={`m${k}-${i}`} className="dot-main" cx={p.x} cy={p.y} r={3.4} />)),
      );
    }
    const auxPhase = phase + (currents.leadDeg * Math.PI) / 180;
    auxSegs.forEach(({ seg, share }, k) => {
      const i = currents.aux * share;
      if (i <= 1e-9) return;
      sloshDots(seg, SPACING, amp(i), auxPhase).forEach((p, j) => dots.push(<path key={`a${k}-${j}`} className="dot-aux" d={diamond(p.x, p.y)} />));
    });
  }

  const topY = TOP + 20;
  return (
    <figure className="circuit-fig">
    <svg ref={ref} className="circuit-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Circuit diagram of a ${method} motor. Select a part for details.`}>
      <path className="wire" d={`M${SRC.x},${SRC.y - SRC.r}V${TOP}H${AUX_X}M${SRC.x},${SRC.y + SRC.r}V${BOT}H${AUX_X}`} />
      {nodes}
      {junctions.map(([x, y]) => (
        <circle key={`${x}-${y}`} className="node" cx={x} cy={y} r={3.6} />
      ))}
      <Part id="supply" label="AC supply" sub={`${fmt(v.voltage, 0)} V · ${fmt(v.frequencyHz, 0)} Hz`} box={{ x: SRC.x - 34, y: SRC.y - SRC.r - 6, w: 34 + SRC.r + 14 + 100, h: 2 * SRC.r + 12 }} labelAt={{ x: SRC.x + SRC.r + 14, y: SRC.y - 3 }} selected={selected} onSelect={onSelect}>
        <g className="sym">
          <circle cx={SRC.x} cy={SRC.y} r={SRC.r} />
          <path d={`M${SRC.x - 16},${SRC.y}q8,-18 16,0t16,0`} />
        </g>
      </Part>
      {currents && (
        <g className="ilabels">
          <text x={MAIN_X + 12} y={topY}>
            I main {fmt(currents.main, 1)} A
          </text>
          {currents.aux > 1e-9 ? (
            <text x={AUX_X + 12} y={topY}>
              I aux {fmt(currents.aux, 1)} A
            </text>
          ) : (
            <text x={AUX_X + 12} y={topY}>
              I aux 0 A (no current)
            </text>
          )}
        </g>
      )}
      <g className="flow">{dots}</g>
      <g className="legend" aria-hidden="true">
        <circle className="dot-main" cx={24} cy={324} r={3.4} />
        <text x={34} y={328}>
          Main-winding current
        </text>
        <path className="dot-aux" d={diamond(190, 324)} />
        <text x={201} y={328}>
          Auxiliary-winding current
        </text>
      </g>
    </svg>
    <figcaption className="muted small">
      The dots slide back and forth to show the alternating current: a bigger swing means a bigger current, and the diamonds are shifted in time from the circles by the displacement angle. The real current alternates {fmt(v.frequencyHz, 0)} times a second; this is slowed down.
    </figcaption>
    </figure>
  );
}

// ---------------------------------------------------------------- phasor picture

const anchorFor = (deg: number): 'start' | 'middle' | 'end' => {
  const c = Math.cos((deg * Math.PI) / 180);
  return c > 0.35 ? 'start' : c < -0.35 ? 'end' : 'middle';
};

/** Voltage (reference), main current and auxiliary current as phasors, with the displacement between the two currents. */
export function PhasorMini({ main, aux }: { main: Complex; aux: Complex | null }) {
  const uid = useId().replace(/:/g, '');
  const O = { x: 118, y: 120 };
  const R = 84;
  const deg = (z: Complex) => (Math.atan2(z.im, z.re) * 180) / Math.PI;
  const mag = (z: Complex) => Math.hypot(z.re, z.im);
  const mMag = mag(main);
  const mDeg = deg(main);
  const aMag = aux ? mag(aux) : 0;
  const aDeg = aux ? deg(aux) : 0;
  const k = R / Math.max(mMag, aMag, 1e-9);
  const mTip = polar(O.x, O.y, mMag * k, mDeg);
  const aTip = polar(O.x, O.y, aMag * k, aDeg);
  const hasAux = aux !== null && aMag > 1e-9;
  const delta = hasAux ? angleBetween(mDeg, aDeg) : 0;
  const arcA = polar(O.x, O.y, 36, mDeg);
  const arcB = polar(O.x, O.y, 36, mDeg + delta);
  const mid = polar(O.x, O.y, 56, mDeg + delta / 2);
  const showAngle = Math.abs(delta) >= 40; // a small angle is stated in the caption instead: the label would sit on the arrows
  const ideal = polar(O.x, O.y, R, mDeg + 90);
  const mLab = polar(O.x, O.y, mMag * k + 12, mDeg);
  const aLab = polar(O.x, O.y, aMag * k + 12, aDeg);
  const summary = hasAux
    ? `Phasor diagram: main current ${fmt(mMag, 1)} amps; auxiliary current ${fmt(aMag, 1)} amps, ${delta >= 0 ? 'leading' : 'lagging'} the main current by ${fmt(Math.abs(delta), 0)} degrees.`
    : `Phasor diagram: main current ${fmt(mMag, 1)} amps; no auxiliary current.`;
  const marker = (suffix: string, color: string) => (
    <marker id={`${uid}-${suffix}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0L10,5L0,10z" fill={color} />
    </marker>
  );
  return (
    <svg className="phasor-svg" viewBox="0 0 270 236" role="img" aria-label={summary}>
      <defs>
        {marker('m', '#46c8b2')}
        {marker('a', '#f2a93b')}
        {marker('v', '#9fb0c6')}
      </defs>
      <circle className="ph-ring" cx={O.x} cy={O.y} r={R} />
      <line className="ph-v" x1={O.x} y1={O.y} x2={O.x + R} y2={O.y} markerEnd={`url(#${uid}-v)`} />
      <text className="ph-t" x={O.x + R + 4} y={O.y + 4}>
        V
      </text>
      {hasAux && (
        <>
          <line className="ph-ideal" x1={O.x} y1={O.y} x2={ideal.x} y2={ideal.y} />
          <text className="ph-t ph-faint" x={ideal.x + (anchorFor(mDeg + 90) === 'end' ? -4 : 4)} y={ideal.y + (Math.sin(((mDeg + 90) * Math.PI) / 180) > 0 ? -4 : 12)} textAnchor={anchorFor(mDeg + 90)}>
            ideal 90°
          </text>
        </>
      )}
      <line className="ph-main" x1={O.x} y1={O.y} x2={mTip.x} y2={mTip.y} markerEnd={`url(#${uid}-m)`} />
      <text className="ph-t" x={mLab.x} y={mLab.y + 4} textAnchor={anchorFor(mDeg)}>
        I main
      </text>
      {hasAux && (
        <>
          <line className="ph-aux" x1={O.x} y1={O.y} x2={aTip.x} y2={aTip.y} markerEnd={`url(#${uid}-a)`} />
          <text className="ph-t" x={aLab.x} y={aLab.y + 4} textAnchor={anchorFor(aDeg)}>
            I aux
          </text>
          <path className="ph-arc" d={`M${arcA.x},${arcA.y}A36,36 0 0 ${delta >= 0 ? 0 : 1} ${arcB.x},${arcB.y}`} />
          {showAngle && (
            <text className="ph-t ph-angle" x={mid.x} y={mid.y + 4} textAnchor="middle">
              {fmt(Math.abs(delta), 0)}°
            </text>
          )}
        </>
      )}
      <text className="ph-t ph-faint" x={8} y={228}>
        {hasAux ? `Aux current ${delta >= 0 ? 'leads' : 'lags'} main by ${fmt(Math.abs(delta), 0)}°` : 'No auxiliary current'}
      </text>
    </svg>
  );
}
