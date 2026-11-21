// The animated part of the field page: stator/rotor cross-section, phasor picture, time controls and the two moving-cursor charts.
// It owns the time state so that only this subtree re-renders every animation frame.
import { useMemo, useState } from 'react';
import { NumberSlider } from '../../components/Controls';
import { LineChart, type Series } from '../../components/LineChart';
import { fmt } from '../../components/format';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { auxCurrent, barEmfMoving, componentsAt, fluxDensity, mainCurrent, phasorsAt, resultant, rotatingComponents, type FieldInputs } from '../../simulations/field';
import { useApp, type FieldMode } from '../../state';
import { FIELD_COLORS } from './colors';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const R_OUT = 270;
const R_BORE = 178;
const R_ROTOR = 168;
const R_BARS = 142;
const R_GAP = 173;
const R_COIL = 224;
const N_BARS = 20;
const N_ARROWS = 36;
const xy = (r: number, th: number): [number, number] => [r * Math.cos(th), -r * Math.sin(th)];
const ring = (ro: number, ri: number): string =>
  `M${-ro} 0A${ro} ${ro} 0 1 0 ${ro} 0A${ro} ${ro} 0 1 0 ${-ro} 0ZM${-ri} 0A${ri} ${ri} 0 1 1 ${ri} 0A${ri} ${ri} 0 1 1 ${-ri} 0Z`;

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth="7" markerHeight="7" refX="5.5" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0 0L7 3.5L0 7Z" fill={color} />
    </marker>
  );
}

/** One side of a coil: a circle holding a dot (current out of the page) or a cross (into the page); fades with |current|. */
function CoilSide({ at, current, color, name }: { at: [number, number]; current: number; color: string; name: string }) {
  const op = 0.3 + 0.7 * Math.min(1, Math.abs(current));
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r="19" fill="#0b1520" stroke={color} strokeWidth="3" />
      <g opacity={op} stroke={color} fill={color}>
        {current >= 0 ? <circle r="6" /> : <path d="M-8 -8L8 8M8 -8L-8 8" strokeWidth="3.4" />}
      </g>
      <text y="-27" textAnchor="middle" fontSize="15" fontWeight="700" fill={color}>
        {name}
      </text>
    </g>
  );
}

interface CrossProps {
  p: FieldInputs;
  wt: number;
  rotor: number;
  mode: FieldMode;
  probeDeg: number;
}

function CrossSection({ p, wt, rotor, mode, probeDeg }: CrossProps) {
  const two = mode === 'twoWinding';
  const g = p.axisDeg * DEG;
  const im = mainCurrent(p, wt);
  const ia = auxCurrent(p, wt);
  const rotAngle = rotor * wt;
  const emax = Math.max(0.3, (p.imAmp + p.iaAmp) * (1 + Math.abs(rotor)));
  const probe = probeDeg * DEG;

  const arrows = [];
  for (let k = 0; k < N_ARROWS; k++) {
    const th = (TAU * k) / N_ARROWS;
    const len = 26 * fluxDensity(p, wt, th);
    if (Math.abs(len) < 3) {
      const [cx, cy] = xy(R_GAP, th);
      arrows.push(<circle key={k} cx={cx} cy={cy} r="1.8" fill={FIELD_COLORS.fwd} opacity="0.7" />);
    } else {
      const [x1, y1] = xy(R_GAP - len / 2, th);
      const [x2, y2] = xy(R_GAP + len / 2, th);
      arrows.push(<line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#bcd3f5" strokeWidth="2.6" markerEnd="url(#fa-head)" />);
    }
  }

  const bars = [];
  for (let k = 0; k < N_BARS; k++) {
    const th = (TAU * k) / N_BARS + rotAngle;
    const e = barEmfMoving(p, wt, th, rotor);
    const [cx, cy] = xy(R_BARS, th);
    const size = 4.5 + 6 * Math.min(1, Math.abs(e) / emax);
    const out = e >= 0;
    bars.push(
      <g key={k} transform={`translate(${cx} ${cy})`}>
        <circle r={size} fill={out ? '#ffd166' : '#0b1520'} stroke={out ? '#7a5a00' : '#ffd166'} strokeWidth="1.8" />
        {Math.abs(e) > 0.04 &&
          (out ? <circle r={Math.max(1.4, size * 0.3)} fill="#3a2a00" /> : <path d={`M${-size * 0.45} ${-size * 0.45}L${size * 0.45} ${size * 0.45}M${size * 0.45} ${-size * 0.45}L${-size * 0.45} ${size * 0.45}`} stroke="#ffd166" strokeWidth="1.8" />)}
      </g>,
    );
  }
  const [mx1, my1] = xy(R_COIL, 0);
  const [mx2, my2] = xy(R_COIL, Math.PI);
  const [ax1, ay1] = xy(R_COIL, g);
  const [ax2, ay2] = xy(R_COIL, g + Math.PI);
  const [tx, ty] = xy(R_ROTOR - 3, rotAngle);
  const [tx2, ty2] = xy(R_ROTOR - 24, rotAngle);
  const [p1x, p1y] = xy(R_ROTOR + 2, probe);
  const [p2x, p2y] = xy(R_OUT + 14, probe);

  return (
    <svg className="field-svg" viewBox="-300 -300 600 600" role="img" aria-label="Cross-section of the stator and a squirrel-cage rotor, with arrows showing the radial magnetic flux in the air gap. A dot means current out of the page, a cross into the page.">
      <defs>
        <Arrow id="fa-head" color="#bcd3f5" />
        <pattern id="fa-lam" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#33475d" />
          <line x1="0" y1="0" x2="0" y2="9" stroke="#4d6783" strokeWidth="2" />
        </pattern>
      </defs>
      <path d={ring(R_OUT, R_BORE)} fillRule="evenodd" fill="url(#fa-lam)" stroke="#8aa3bd" strokeWidth="2" />
      <line x1={-R_OUT} y1="0" x2={R_OUT} y2="0" stroke={FIELD_COLORS.main} strokeWidth="1.3" strokeDasharray="6 6" opacity="0.5" />
      {two && <line x1={xy(R_OUT, g + Math.PI)[0]} y1={xy(R_OUT, g + Math.PI)[1]} x2={xy(R_OUT, g)[0]} y2={xy(R_OUT, g)[1]} stroke={FIELD_COLORS.aux} strokeWidth="1.3" strokeDasharray="6 6" opacity="0.5" />}
      <CoilSide at={[mx1, my1]} current={im} color={FIELD_COLORS.main} name="M" />
      <CoilSide at={[mx2, my2]} current={-im} color={FIELD_COLORS.main} name="M′" />
      {two && <CoilSide at={[ax1, ay1]} current={ia} color={FIELD_COLORS.aux} name="A" />}
      {two && <CoilSide at={[ax2, ay2]} current={-ia} color={FIELD_COLORS.aux} name="A′" />}

      <circle r={R_ROTOR} fill="#16273a" stroke="#8aa3bd" strokeWidth="2" />
      {bars}
      <circle r="26" fill="#2c4058" stroke="#8aa3bd" strokeWidth="2" />
      <line x1={tx} y1={ty} x2={tx2} y2={ty2} stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
      {arrows}
      <line x1={p1x} y1={p1y} x2={p2x} y2={p2y} stroke="#ffffff" strokeWidth="2" strokeDasharray="3 3" />
      <circle cx={xy(R_GAP, probe)[0]} cy={xy(R_GAP, probe)[1]} r="6" fill="#ffffff" stroke="#0b1520" strokeWidth="2" />
      <text x={xy(R_OUT + 28, probe)[0]} y={xy(R_OUT + 28, probe)[1] + 5} textAnchor="middle" fontSize="15" fontWeight="700" fill="#ffffff">
        P
      </text>
    </svg>
  );
}

function PhasorView({ p, wt, parts }: { p: FieldInputs; wt: number; parts: boolean }) {
  const S = 52;
  const { forward, sum } = phasorsAt(p, wt);
  const trace = useMemo(() => {
    let d = '';
    for (let k = 0; k <= 120; k++) {
      const q = resultant(p, (k / 120) * TAU);
      d += `${k ? 'L' : 'M'}${(q.x * S).toFixed(1)} ${(-q.y * S).toFixed(1)}`;
    }
    return d;
  }, [p]);
  const f = [forward.x * S, -forward.y * S];
  const s = [sum.x * S, -sum.y * S];
  const lab = (v: number[], dx: number, dy: number) => ({ x: v[0] + dx, y: v[1] + dy });
  return (
    <svg className="field-svg" viewBox="-125 -125 250 250" role="img" aria-label="Phasor picture: the forward and backward rotating fields add up to the actual resultant flux vector.">
      <defs>
        <Arrow id="ph-f" color={FIELD_COLORS.fwd} />
        <Arrow id="ph-b" color={FIELD_COLORS.bwd} />
        <Arrow id="ph-r" color={FIELD_COLORS.res} />
      </defs>
      <circle r={S} fill="none" stroke="#2a425c" strokeDasharray="2 4" />
      <circle r={2 * S} fill="none" stroke="#2a425c" strokeDasharray="2 4" />
      <line x1="-120" y1="0" x2="120" y2="0" stroke="#2a425c" />
      <line x1="0" y1="-120" x2="0" y2="120" stroke="#2a425c" />
      <path d={trace} fill="none" stroke="#a2b5ca" strokeWidth="1.4" strokeDasharray="1.5 3.5" />
      {parts && <line x1="0" y1="0" x2={f[0]} y2={f[1]} stroke={FIELD_COLORS.fwd} strokeWidth="3.4" markerEnd="url(#ph-f)" />}
      {parts && <line x1={f[0]} y1={f[1]} x2={s[0]} y2={s[1]} stroke={FIELD_COLORS.bwd} strokeWidth="3.4" strokeDasharray="7 4" markerEnd="url(#ph-b)" />}
      <line x1="0" y1="0" x2={s[0]} y2={s[1]} stroke={FIELD_COLORS.res} strokeWidth="4.4" markerEnd="url(#ph-r)" />
      {parts && (
        <>
          <text {...lab(f, 7, -7)} fontSize="12" fontWeight="700" fill={FIELD_COLORS.fwd}>
            F
          </text>
          <text {...lab(s, 8, 4)} fontSize="12" fontWeight="700" fill={FIELD_COLORS.res}>
            R
          </text>
        </>
      )}
      <text x="-118" y="-112" fontSize="10" fill="#a2b5ca">
        rings: amplitude 1 and 2
      </text>
    </svg>
  );
}

interface StageProps {
  p: FieldInputs;
  mode: FieldMode;
  rotor: number;
  probeDeg: number;
}

export default function FieldStage({ p, mode, rotor, probeDeg }: StageProps) {
  const { motionOn } = useApp();
  const [wt, setWt] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(0.15);
  const running = playing && motionOn;
  useAnimationFrame((dt) => setWt((w) => (w + TAU * speed * dt) % TAU), running);

  const two = mode === 'twoWinding';
  const parts = mode !== 'pulsating';
  const deg = ((wt / DEG) % 360 + 360) % 360;
  const comps = rotatingComponents(p);

  const degs = useMemo(() => Array.from({ length: 181 }, (_, i) => i * 2), []);
  const currentSeries = useMemo<Series[]>(() => {
    const s: Series[] = [{ id: 'im', label: 'Main winding current', points: degs.map((d) => [d, mainCurrent(p, d * DEG)]), color: FIELD_COLORS.main, width: 3 }];
    if (two) s.push({ id: 'ia', label: 'Auxiliary winding current', points: degs.map((d) => [d, auxCurrent(p, d * DEG)]), color: FIELD_COLORS.aux, dash: '9 5', width: 3 });
    return s;
  }, [p, two, degs]);
  const probeSeries = useMemo<Series[]>(() => {
    const th = probeDeg * DEG;
    const s: Series[] = [];
    if (parts) {
      s.push({ id: 'fwd', label: 'Forward field at P', points: degs.map((d) => [d, componentsAt(p, d * DEG, th).forward]), color: FIELD_COLORS.fwd, width: 2.5 });
      s.push({ id: 'bwd', label: 'Backward field at P', points: degs.map((d) => [d, componentsAt(p, d * DEG, th).backward]), color: FIELD_COLORS.bwd, dash: '8 5', width: 2.5 });
    }
    s.push({ id: 'tot', label: parts ? 'Sum = actual flux at P' : 'Actual flux at P', points: degs.map((d) => [d, fluxDensity(p, d * DEG, th)]), color: FIELD_COLORS.res, width: 3.5 });
    return s;
  }, [p, parts, probeDeg, degs]);
  const ampMax = Math.max(1.2, comps.ccwAmp + comps.cwAmp + 0.2, p.imAmp + p.iaAmp + 0.2);

  const res = resultant(p, wt);
  const resAngle = ((Math.atan2(res.y, res.x) / DEG) % 360 + 360) % 360;

  return (
    <section className="panel field-stage" aria-labelledby="stage-h">
      <h2 id="stage-h">The air-gap field</h2>
      <div className="field-figs">
        <figure>
          <CrossSection p={p} wt={wt} rotor={rotor} mode={mode} probeDeg={probeDeg} />
          <figcaption>
            <strong>Cross-section.</strong> Arrows: radial flux in the air gap (length = strength, pointing outward or inward). Coil sides M, M′{two ? ', A, A′' : ''}: ● current out of the page, ✖ into the page. Rotor bars: ● / ✖ show the induced current
            direction, a bigger bar means a stronger induced current. White mark: rotor position. P: the probe point used in the lower chart. Angles are electrical degrees.
          </figcaption>
        </figure>
        <figure>
          <PhasorView p={p} wt={wt} parts={parts} />
          <figcaption>
            <strong>Phasor picture.</strong> <span className="key key-res">R</span> is the actual flux vector (solid, thick); its tip follows the dotted path.
            {parts ? (
              <>
                {' '}
                It is the sum of the <span className="key key-fwd">F</span> counter-clockwise (forward) field (solid) and the <span className="key key-bwd">B</span> clockwise (backward) field (dashed), drawn tip to tail.
              </>
            ) : (
              ' With one winding it just slides back and forth along the main axis: it never turns.'
            )}
          </figcaption>
        </figure>
      </div>

      <div className="field-time">
        <button type="button" className="btn" aria-pressed={playing} onClick={() => setPlaying((v) => !v)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <NumberSlider label="Time within one supply cycle" unit="°" min={0} max={360} step={1} value={Math.round(deg) % 360} onChange={(v) => { setPlaying(false); setWt(v * DEG); }} />
        <NumberSlider label="Animation speed" unit="cycles/s" min={0.05} max={1} step={0.05} value={speed} onChange={setSpeed} hint="Real supply: 50 or 60 cycles/s." />
      </div>
      {!motionOn && <p className="muted small">Animations are paused (top bar or system setting). Move the time slider to step through the cycle.</p>}
      <p className="field-live" role="status" aria-live="off">
        ωt = {fmt(deg, 0)}° · i<sub>m</sub> = {fmt(mainCurrent(p, wt), 2)}
        {two ? <> · i<sub>a</sub> = {fmt(auxCurrent(p, wt), 2)}</> : null} · flux vector: amplitude {fmt(Math.hypot(res.x, res.y), 2)} at {fmt(resAngle, 0)}°
      </p>

      <div className="fault-charts">
        <LineChart
          title="Winding currents over one supply cycle"
          desc="Main and auxiliary winding current against time over one cycle, with a cursor at the animated instant."
          series={currentSeries}
          xLabel="Time within the cycle (ωt, degrees)"
          yLabel="Current (relative)"
          xDomain={[0, 360]}
          yDomain={[-1.2, 1.2]}
          cursorX={deg}
          height={260}
        />
        <LineChart
          title={`Flux density at the probe point P (${probeDeg}°)`}
          desc="Radial flux density at the probe point against time, split into the forward and backward rotating fields where shown."
          series={probeSeries}
          xLabel="Time within the cycle (ωt, degrees)"
          yLabel="Flux density (relative)"
          xDomain={[0, 360]}
          yDomain={[-ampMax, ampMax]}
          cursorX={deg}
          height={260}
        />
      </div>
    </section>
  );
}
