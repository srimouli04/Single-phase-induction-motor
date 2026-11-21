import { useMemo, useRef, useState } from 'react';
import { Callout } from '../../components/Badges';
import { NumberSlider, ResetButton, Segmented } from '../../components/Controls';
import { Eq } from '../../components/Eq';
import { Beginner, Detailed } from '../../components/Level';
import { LineChart, type Band, type Series } from '../../components/LineChart';
import { Readouts, type Reading } from '../../components/Readouts';
import { Term } from '../../components/Term';
import { fmt } from '../../components/format';
import { useClock } from '../../hooks/useClock';
import { auxCurrent, ellipseAxes, mainCurrent, resultant, rotation, torqueIndex, type FieldInputs } from '../../simulations/field';
import { compareMethods } from '../../simulations/starting';
import { useApp } from '../../state';
import { FIELD_COLORS } from '../field/colors';
import { fieldPattern } from '../field/pattern';
import { Head } from './ChainGlyphs';
import { WT0 } from './chain';

const IDEAL = 90;

/** Time-phase lead of the auxiliary current at standstill in the example motor, from the same model the Starting section uses. */
const EXAMPLE_LEAD = (() => {
  const cmp = compareMethods({ loadTorque: 0.3 });
  const lead = (id: string) => Math.round(cmp.methods.find((m) => m.id === id)!.start.auxLeadDeg);
  return { split: lead('split-phase'), cap: lead('capacitor-start') };
})();

const PRESETS = [
  { label: 'No shift (0°)', phi: 0 },
  { label: `Split-phase motor (${EXAMPLE_LEAD.split}°)`, phi: EXAMPLE_LEAD.split },
  { label: `Capacitor-start motor (${EXAMPLE_LEAD.cap}°)`, phi: EXAMPLE_LEAD.cap },
  { label: 'Ideal (90°)', phi: IDEAL },
  { label: 'Auxiliary lags (−90°)', phi: -IDEAL },
];

const wrap360 = (d: number) => ((d % 360) + 360) % 360;

/** The tip of the field vector traced over one cycle, with the vector itself, for windings 90° apart in space. */
function FieldTip({ p, wt }: { p: FieldInputs; wt: number }) {
  const S = 80;
  const C = 120;
  const at = (t: number) => {
    const v = resultant(p, t);
    return { x: C + S * v.x, y: C - S * v.y };
  };
  const trace = Array.from({ length: 121 }, (_, i) => {
    const q = at((2 * Math.PI * i) / 120);
    return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(' ');
  const tip = at(wt);
  const turning = rotation(p, 1e-3) !== 'pulsating' && ellipseAxes(p).circularity > 0.1;
  return (
    <svg className="fieldtip" viewBox="0 0 240 240" role="img" aria-label="Path traced by the tip of the resultant field vector over one cycle.">
      <line className="cg-axis" x1={14} y1={C} x2={226} y2={C} />
      <line className="cg-axis" x1={C} y1={14} x2={C} y2={226} />
      <circle className="cg-orbit" cx={C} cy={C} r={S} />
      <polyline points={trace} fill="none" stroke={FIELD_COLORS.res} strokeWidth={2.6} strokeLinejoin="round" />
      {turning &&
        [0, 2.1, 4.2].map((t) => {
          const a = at(t);
          const b = at(t + 0.05);
          const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          return <Head key={t} x={a.x} y={a.y} ux={(b.x - a.x) / d} uy={(b.y - a.y) / d} size={10} color={FIELD_COLORS.res} />;
        })}
      <line x1={C} y1={C} x2={tip.x} y2={tip.y} stroke="#e9eef5" strokeWidth={3} strokeLinecap="round" />
      <circle cx={tip.x} cy={tip.y} r={6} fill="#e9eef5" />
      <text className="cg-txt" x={232} y={C + 18} textAnchor="end">
        main
      </text>
      <text className="cg-txt" x={C + 6} y={22}>
        aux
      </text>
    </svg>
  );
}

/** Phase-shift demo: two current waveforms with a moving time marker and the path of the resultant field. */
export default function PhaseDemo() {
  const { navigate } = useApp();
  const ref = useRef<HTMLElement>(null);
  const wt = useClock(ref, 0.3) + WT0;
  const [aux, setAux] = useState(true);
  const [phi, setPhi] = useState(IDEAL);

  // windings 90° apart in space, equal peak currents: only the time shift (and whether the auxiliary winding is connected) changes
  const p = useMemo<FieldInputs>(() => ({ imAmp: 1, iaAmp: aux ? 1 : 0, phaseDeg: phi, axisDeg: 90 }), [aux, phi]);
  const startRel = Math.abs(torqueIndex(p));
  const ell = ellipseAxes(p);

  const series = useMemo<Series[]>(() => {
    const pts = (f: (rad: number) => number) => Array.from({ length: 181 }, (_, i) => [i * 2, f((i * 2 * Math.PI) / 180)] as const);
    const out: Series[] = [{ id: 'm', label: 'Main current', color: FIELD_COLORS.main, width: 2.8, points: pts((r) => mainCurrent(p, r)) }];
    if (aux) out.push({ id: 'a', label: 'Auxiliary current', color: FIELD_COLORS.aux, width: 2.8, dash: '9 5', points: pts((r) => auxCurrent(p, r)) });
    return out;
  }, [p, aux]);

  // the shift, drawn as the gap between the peak of the auxiliary current and the next peak of the main current
  const bands = useMemo<Band[]>(() => {
    if (!aux || Math.abs(phi) < 1) return [];
    const peak = wrap360(-phi); // auxiliary current peaks at this angle of the main cycle
    return [phi > 0 ? { from: peak, to: 360, label: `${Math.abs(phi)}° ahead` } : { from: 0, to: peak, label: `${Math.abs(phi)}° behind` }];
  }, [aux, phi]);

  const none = startRel < 0.005;
  const items: Reading[] = [
    { label: 'Field pattern', value: fieldPattern(p) },
    { label: 'How round is the field', value: `${fmt(ell.circularity * 100, 0)} %`, hint: '100 % is a perfect circle, 0 % a straight line' },
    {
      label: 'Starting torque',
      term: 'startingTorque',
      value: `${fmt(startRel * 100, 0)} %`,
      tone: none ? 'bad' : 'ok',
      hint: none ? 'None: the rotor would not start' : 'Of an ideal two-phase motor with equal currents',
    },
  ];

  return (
    <section ref={ref} className="panel" aria-labelledby="pd-h">
      <div className="panel-head">
        <h2 id="pd-h">One supply, two currents: why the shift matters</h2>
        <ResetButton
          onClick={() => {
            setAux(true);
            setPhi(IDEAL);
          }}
        />
      </div>
      <p>
        One winding makes a field that only pulsates along a line. To make it turn, a second winding 90° away in space needs a current that peaks at a different moment, shifted by the <Term id="phaseDisplacement">phase displacement</Term> φ. Change φ below and watch the path of the
        field.
      </p>
      <Beginner>
        <p className="muted">
          Think of a merry-go-round. Two people pushing from the same side at the same moment only squeeze it. If the second person pushes from the side, a quarter-turn later, the push travels round the ride and it spins up. The second winding is the second pusher, and φ is
          the delay.
        </p>
      </Beginner>

      <div className="demo-layout">
        <div className="demo-controls">
          <Segmented
            label="Auxiliary winding"
            value={aux ? 'on' : 'off'}
            onChange={(v) => setAux(v === 'on')}
            options={[
              { value: 'on', label: 'Connected' },
              { value: 'off', label: 'Disconnected' },
            ]}
          />
          <NumberSlider
            label="Phase displacement φ"
            term="phaseDisplacement"
            unit="°"
            min={-180}
            max={180}
            step={1}
            value={phi}
            disabled={!aux}
            onChange={setPhi}
            hint="How far the auxiliary current leads the main current in time (negative: lags). Both currents are equal in size here."
          />
          <fieldset className="presets">
            <legend>Presets</legend>
            <div className="row">
              {PRESETS.map((pr) => (
                <button key={pr.label} type="button" className="btn btn-sm" aria-pressed={aux && phi === pr.phi} disabled={!aux} onClick={() => setPhi(pr.phi)}>
                  {pr.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Readouts items={items} label="Result of the phase shift" />
        </div>

        <div className="demo-figs">
          <LineChart
            title="The two winding currents over one cycle"
            desc="Main current and auxiliary current against time in degrees of the cycle. A marker moves along both curves."
            series={series}
            bands={bands}
            xLabel="Time (degrees of one supply cycle)"
            yLabel="Current (relative)"
            xDomain={[0, 360]}
            yDomain={[-1.2, 1.2]}
            height={250}
            cursorX={((wt * 180) / Math.PI) % 360}
          />
          <figure className="fieldtip-fig">
            <FieldTip p={p} wt={wt} />
            <figcaption className="muted small">
              Tip of the field vector over one cycle. The horizontal axis is the main winding’s axis and the vertical axis the auxiliary winding’s, 90° away. A circle means a field of constant size that turns; a line means a field that only pulsates; an ellipse is in
              between. Arrow heads show the way it turns.
            </figcaption>
          </figure>
        </div>
      </div>

      <Callout tone="tip" title="What to try">
        <ul>
          <li>Set φ to 0°: both currents peak together, the field only pulsates along a diagonal line, and the starting torque is zero.</li>
          <li>Set φ to 90°: a perfect circle and the largest starting torque. Real motors get close with a capacitor.</li>
          <li>Choose the split-phase preset ({EXAMPLE_LEAD.split}°): the ellipse is thin, so the starting torque is modest. Choose capacitor-start ({EXAMPLE_LEAD.cap}°): nearly a circle.</li>
          <li>Set φ to −90°: the same circle turns the other way. Swapping the auxiliary winding’s connections reverses a motor.</li>
          <li>Disconnect the auxiliary winding: only a pulsating field is left, which cannot start the rotor but can keep a turning rotor going (Section 3).</li>
        </ul>
      </Callout>

      <div className="row">
        <button type="button" className="btn" onClick={() => navigate('field', { field: { mode: 'twoWinding', inputs: { imAmp: 1, iaAmp: aux ? 1 : 0, phaseDeg: phi, axisDeg: 90 } } })}>
          Explore this field in cross-section →
        </button>
        <button type="button" className="btn" onClick={() => navigate('starting')}>
          How real motors make the shift →
        </button>
      </div>

      <Detailed>
        <h3>The mathematics</h3>
        <Eq block>{'i_m = I cos ωt,   i_a = I cos(ωt + φ)'}</Eq>
        <Eq block>{'T_{start} ∝ A_F² − A_B² = − B_m B_a sin γ sin φ'}</Eq>
        <p>
          The windings are γ = 90° apart in space, so the torque at standstill is proportional to sin φ: zero for φ = 0° or 180°, largest for ±90°, and its sign gives the direction. The sizes of the two currents matter too (<Eq>B_a</Eq> and <Eq>B_m</Eq>); here they are equal to isolate
          the effect of the shift. Section 3 splits the field into forward and backward parts <Eq>A_F</Eq> and <Eq>A_B</Eq>.
        </p>
      </Detailed>
    </section>
  );
}
