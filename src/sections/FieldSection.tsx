import { useEffect, useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { Callout, ModelBadge } from '../components/Badges';
import { NumberSlider, ResetButton, Segmented } from '../components/Controls';
import { Eq } from '../components/Eq';
import { Detailed } from '../components/Level';
import { LineChart, type Series } from '../components/LineChart';
import { Readouts, type Reading } from '../components/Readouts';
import { Term } from '../components/Term';
import { fmt } from '../components/format';
import { DEFAULT_FIELD, MAIN_ONLY_FIELD, ellipseAxes, fieldTorques, rotatingComponents, rotation, type FieldInputs } from '../simulations/field';
import { useApp, type FieldMode } from '../state';
import { FIELD_COLORS } from './field/colors';
import FieldStage from './field/FieldStage';
import { fieldPattern } from './field/pattern';

const MODES: { value: FieldMode; label: string }[] = [
  { value: 'pulsating', label: '1  Main winding only' },
  { value: 'double', label: '2  Two opposite fields' },
  { value: 'twoWinding', label: '3  Main + auxiliary winding' },
];
const DEFAULTS: Record<FieldMode, FieldInputs> = { pulsating: MAIN_ONLY_FIELD, double: MAIN_ONLY_FIELD, twoWinding: DEFAULT_FIELD };

const PRESETS: { label: string; inputs: FieldInputs }[] = [
  { label: 'Ideal two-phase', inputs: { imAmp: 1, iaAmp: 1, phaseDeg: 90, axisDeg: 90 } },
  { label: 'Capacitor-start', inputs: { imAmp: 1, iaAmp: 0.9, phaseDeg: 75, axisDeg: 90 } },
  { label: 'Split-phase', inputs: { imAmp: 1, iaAmp: 0.6, phaseDeg: 25, axisDeg: 90 } },
  { label: 'Same phase (no shift)', inputs: { imAmp: 1, iaAmp: 1, phaseDeg: 0, axisDeg: 90 } },
  { label: 'Swap auxiliary leads', inputs: { imAmp: 1, iaAmp: 1, phaseDeg: -90, axisDeg: 90 } },
  { label: 'Axes only 45° apart', inputs: { imAmp: 1, iaAmp: 1, phaseDeg: 90, axisDeg: 45 } },
];

const same = (a: FieldInputs, b: FieldInputs): boolean => a.imAmp === b.imAmp && a.iaAmp === b.iaAmp && a.phaseDeg === b.phaseDeg && a.axisDeg === b.axisDeg;

const EXPLAIN: Record<FieldMode, { title: string; text: string; tips: string[] }> = {
  pulsating: {
    title: 'One winding: a field that pulsates',
    text: 'A single winding carries alternating current, so the field it makes along its axis alternates too: it grows, shrinks, reverses and never turns. A stationary rotor sees a changing flux, so currents are induced in its bars (transformer action), but the forces on the bars on opposite sides of the rotor cancel. There is no torque to start it.',
    tips: [
      'Press Pause and drag the time slider: every flux arrow grows, shrinks and reverses together, and none of them travels around the gap.',
      'Look at the phasor picture: the flux vector only slides back and forth along the main axis.',
      'Set the rotor speed to +10 %, then to −10 %: the torque is not zero any more, and it pushes the rotor the way it is already turning. A motor that is spun up keeps turning.',
    ],
  },
  double: {
    title: 'Two fields turning in opposite directions',
    text: 'Mathematically, a pulsating field is the sum of two equal fields, each half as big, rotating in opposite directions at synchronous speed. This is the double-revolving-field idea. At every instant the two add up to a vector along the main axis, exactly as the single pulsating field does. The rotor responds to each field separately, so a single-phase motor can be analysed as two rotating-field motors on one shaft, pulling opposite ways.',
    tips: [
      'In the phasor picture the blue (forward) and dashed pink (backward) vectors, drawn tip to tail, always end on the thick resultant.',
      'In the lower chart the blue and pink curves add up point by point to the amber curve: the real flux at P.',
      'In the torque chart at 0 % speed the forward and backward torques are equal and opposite, so the net is zero. Move the rotor speed to the right and the forward torque grows while the backward torque shrinks.',
    ],
  },
  twoWinding: {
    title: 'Two windings: a field that can rotate',
    text: 'A second winding, placed at an angle in space and carrying a current that is shifted in time, makes a second pulsating field. Added to the first it gives a resultant that turns. Equal currents 90° apart in time in two windings 90° apart in space give a perfect circle. Anything less gives an ellipse, which still has more of one rotating component than the other, and so a net starting torque in the direction of the larger one.',
    tips: [
      'Choose “Same phase (no shift)”: the two currents peak together, the field only pulsates along a tilted line, and the starting torque is zero. A split-phase or capacitor-start motor needs the time shift.',
      'Choose “Ideal two-phase”, then lower the auxiliary current or the phase shift: the circle becomes an ellipse and the backward field appears.',
      'Choose “Swap auxiliary leads”: the same circle turns the other way. That is how these motors are reversed.',
      'Choose “Axes only 45° apart”: the geometry matters as much as the currents.',
    ],
  },
};

export default function FieldSection() {
  const { takeHandoff } = useApp();
  const [mode, setMode] = useState<FieldMode>('pulsating');
  const [inputs, setInputs] = useState<FieldInputs>(MAIN_ONLY_FIELD);
  const [rotor, setRotor] = useState(0);
  const [probe, setProbe] = useState(60);
  const [stageKey, setStageKey] = useState(0);

  // Arrive from a guided experiment or another section with a configuration already chosen (consumed once; safe under StrictMode).
  useEffect(() => {
    const h = takeHandoff()?.field;
    if (!h) return;
    setMode(h.mode);
    setInputs({ ...DEFAULTS[h.mode], ...h.inputs });
    setRotor(h.rotorSpeed ?? 0);
  }, [takeHandoff]);

  const two = mode === 'twoWinding';
  const p = useMemo<FieldInputs>(() => (two ? inputs : { ...inputs, iaAmp: 0 }), [two, inputs]);
  const patch = (q: Partial<FieldInputs>) => setInputs((v) => ({ ...v, ...q }));
  const changeMode = (m: FieldMode) => {
    setMode(m);
    setInputs(DEFAULTS[m]);
  };
  const reset = () => {
    setInputs(DEFAULTS[mode]);
    setRotor(0);
    setProbe(60);
    setStageKey((k) => k + 1);
  };

  const comps = rotatingComponents(p);
  const ell = ellipseAxes(p);
  const standstill = fieldTorques(p, 0).net;
  const atSpeed = fieldTorques(p, rotor);
  const rot = rotation(p, 1e-3);
  const items: Reading[] = [
    { label: 'Field pattern', value: fieldPattern(p), hint: rot === 'pulsating' ? 'Both rotating parts are equal' : undefined },
    { label: 'Forward field', term: 'forwardBackward', value: fmt(comps.ccwAmp, 2), hint: 'Counter-clockwise part (amplitude)' },
    { label: 'Backward field', value: fmt(comps.cwAmp, 2), hint: 'Clockwise part (amplitude)' },
    { label: 'Ellipse: long / short axis', value: `${fmt(ell.major, 2)} / ${fmt(ell.minor, 2)}`, hint: ell.major > 1e-6 ? `${fmt(ell.circularity * 100, 0)} % of the way to a circle` : undefined },
    {
      label: 'Torque at standstill',
      term: 'startingTorque',
      value: fmt(Math.abs(standstill), 2),
      hint: Math.abs(standstill) < 0.005 ? 'None: the motor will not start' : standstill > 0 ? 'Pushes counter-clockwise' : 'Pushes clockwise',
      tone: Math.abs(standstill) < 0.005 ? 'bad' : 'ok',
    },
    {
      label: `Net torque at ${fmt(rotor * 100, 0)} % speed`,
      value: fmt(Math.abs(atSpeed.net), 2),
      hint: Math.abs(atSpeed.net) < 0.005 ? 'Zero' : atSpeed.net > 0 ? 'Pushes counter-clockwise' : 'Pushes clockwise',
    },
  ];

  const torqueSeries = useMemo<Series[]>(() => {
    const pts = Array.from({ length: 201 }, (_, i) => (i - 100) / 100);
    const f = pts.map((r) => fieldTorques(p, r));
    return [
      { id: 'fwd', label: 'Forward (counter-clockwise) field torque', points: pts.map((r, i) => [r * 100, f[i].forward]), color: FIELD_COLORS.fwd, width: 2.5 },
      { id: 'bwd', label: 'Backward (clockwise) field torque', points: pts.map((r, i) => [r * 100, f[i].backward]), color: FIELD_COLORS.bwd, dash: '8 5', width: 2.5 },
      { id: 'net', label: 'Net torque', points: pts.map((r, i) => [r * 100, f[i].net]), color: FIELD_COLORS.res, width: 3.5 },
    ];
  }, [p]);
  const torqueRange = Math.max(0.25, ...torqueSeries.flatMap((s) => s.points.map(([, y]) => Math.abs(y))));
  const ex = EXPLAIN[mode];

  return (
    <Page id="field">
      <ModelBadge kinds={['illustration', 'analytical']}>
        The cross-section and arrows are an idealised drawing (sinusoidal windings, exaggerated air gap, electrical angles). The torque curves come from a simplified constant-flux rotor model, not from a datasheet.
      </ModelBadge>

      <Segmented label="What to look at" options={MODES} value={mode} onChange={changeMode} />

      <section className="panel field-intro" aria-labelledby="fi-h">
        <h2 id="fi-h">{ex.title}</h2>
        <p>{ex.text}</p>
      </section>

      <div className="field-layout">
        <aside className="field-side" aria-label="Field controls">
          <div className="panel">
            <div className="panel-head">
              <h2>Controls</h2>
              <ResetButton onClick={reset} label="Reset" />
            </div>
            <NumberSlider label="Main-winding current" unit="× max" min={0} max={1} step={0.05} value={inputs.imAmp} onChange={(v) => patch({ imAmp: v })} />
            {two && (
              <>
                <NumberSlider label="Auxiliary-winding current" unit="× max" min={0} max={1} step={0.05} value={inputs.iaAmp} onChange={(v) => patch({ iaAmp: v })} />
                <NumberSlider
                  label="Phase displacement"
                  term="phaseDisplacement"
                  unit="°"
                  min={-180}
                  max={180}
                  step={5}
                  value={inputs.phaseDeg}
                  onChange={(v) => patch({ phaseDeg: v })}
                  hint="How far the auxiliary current leads the main current in time (negative: lags)."
                />
                <NumberSlider label="Axis angle" unit="°" min={0} max={180} step={5} value={inputs.axisDeg} onChange={(v) => patch({ axisDeg: v })} hint="How far the auxiliary winding is turned from the main winding, in electrical degrees." />
                <fieldset className="presets">
                  <legend>Presets</legend>
                  <div className="row">
                    {PRESETS.map((pr) => (
                      <button key={pr.label} type="button" className="btn btn-sm" aria-pressed={same(inputs, pr.inputs)} onClick={() => setInputs(pr.inputs)}>
                        {pr.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              </>
            )}
            <NumberSlider
              label="Rotor speed"
              term="rotorSpeed"
              unit="% of sync"
              min={-100}
              max={100}
              step={5}
              value={Math.round(rotor * 100)}
              onChange={(v) => setRotor(v / 100)}
              hint="Plus: turning counter-clockwise, with the forward field. Try the rotor at standstill first, then give it a push."
            />
            <NumberSlider label="Probe point P" unit="°" min={0} max={355} step={5} value={probe} onChange={setProbe} hint="Where on the stator the lower chart looks at the flux." />
          </div>
        </aside>

        <div className="field-main">
          <FieldStage key={stageKey} p={p} mode={mode} rotor={rotor} probeDeg={probe} />

          <section className="panel" aria-labelledby="fr-h">
            <h2 id="fr-h">What the field does</h2>
            <Readouts items={items} label="Field results" />
          </section>

          <section className="panel" aria-labelledby="ft-h">
            <h2 id="ft-h">
              <Term id="forwardBackward">Forward and backward</Term> torque against rotor speed
            </h2>
            <p className="muted small">The rotor feels each field with its own slip: 1 − r for the forward field and 1 + r for the backward one, where r is the rotor speed as a fraction of synchronous speed.</p>
            <LineChart
              title="Torque of each rotating field, and the net"
              desc="Forward, backward and net torque against rotor speed, with a marker at the chosen rotor speed."
              series={torqueSeries}
              markers={[{ x: rotor * 100, y: atSpeed.net, label: 'Net torque at this speed', color: FIELD_COLORS.res, shape: 'diamond' }]}
              vLines={[{ value: rotor * 100, label: 'Rotor speed', color: '#a2b5ca', dash: '4 4' }]}
              xLabel="Rotor speed (% of synchronous speed; + = counter-clockwise)"
              yLabel="Torque (relative)"
              xDomain={[-100, 100]}
              yDomain={[-torqueRange * 1.1, torqueRange * 1.1]}
              height={320}
            />
            <Callout tone="tip" title="What to notice">
              <ul>
                {ex.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </Callout>
          </section>

          <Detailed>
            <h3>The mathematics</h3>
            {mode !== 'twoWinding' ? (
              <>
                <Eq block>{'B_m cos ωt cos θ = ½ B_m cos(θ − ωt) + ½ B_m cos(θ + ωt)'}</Eq>
                <p>
                  The first term on the right is a field turning forward (the <Term id="rotatingField">rotating field</Term> at synchronous speed), the second turns backward. Each has half the amplitude of the pulsating field.
                </p>
              </>
            ) : (
              <>
                <Eq block>{'b(θ, t) = i_m cos θ + i_a cos(θ − γ)'}</Eq>
                <Eq block>{'A_F = ½ |B_m + B_a e^{j(γ + φ)}|,   A_B = ½ |B_m + B_a e^{j(γ − φ)}|'}</Eq>
                <Eq block>{'T_{start} ∝ A_F² − A_B² = − B_m B_a sin γ sin φ'}</Eq>
                <p>
                  γ is the angle between the winding axes (space) and φ the lead of the auxiliary current (time). The starting torque needs <em>both</em> sin γ and sin φ to be non-zero, and is largest for γ = φ = 90° with equal amplitudes. A circle means
                  that <Eq>A_B</Eq> is zero.
                </p>
              </>
            )}
            <Eq block>{'t(s) = 2 k s / (k² + s²),   T_{net} = A_F² t(1 − r) − A_B² t(1 + r)'}</Eq>
            <p className="muted small">
              This torque shape is for a rotor with constant flux and a rotor resistance-to-reactance ratio k = 0.3 (peak at slip 0.3). The Physics lab uses the full equivalent circuit, which adds the stator impedance and the magnetising branch.
            </p>
          </Detailed>
        </div>
      </div>
    </Page>
  );
}
