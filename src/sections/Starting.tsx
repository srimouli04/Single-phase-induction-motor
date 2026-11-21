import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Page } from '../components/Page';
import { Callout, ModelBadge } from '../components/Badges';
import { ResetButton, Segmented } from '../components/Controls';
import { Eq, Rich } from '../components/Eq';
import { Beginner, Detailed } from '../components/Level';
import { Readouts, type Reading } from '../components/Readouts';
import { fmt } from '../components/format';
import { METHOD_BY_ID, STARTING_INTRO, STARTING_METHODS, isMethodId, type MethodId, type PartKey } from '../content/startingMethods';
import { useApp } from '../state';
import { lineCurrent } from '../simulations/metrics';
import { DEFAULT_INPUTS, methodDefaults, type LabInputs } from '../simulations/motorModel';
import { CAP_UF, compareMethods, type Comparison as Result } from '../simulations/starting';
import { CircuitDiagram, PhasorMini, type CircuitMethod } from './starting/CircuitDiagram';
import Comparison from './starting/Comparison';
import { PartCard } from './starting/Part';
import ShadedPole from './starting/ShadedPole';
import StartTransition from './starting/StartTransition';

const DEFAULT_LOAD = 0.3;
const VALUES = { voltage: DEFAULT_INPUTS.voltage, frequencyHz: DEFAULT_INPUTS.frequencyHz, startUF: CAP_UF.start, runUF: CAP_UF.run, auxR: DEFAULT_INPUTS.auxResistance };
/** A shaded-pole motor seen as two weak, shifted fluxes: the unshaded part leads, the shaded part is weaker and lags. */
const SHADED_FIELD = { imAmp: 0.65, iaAmp: 1, phaseDeg: 50, axisDeg: 45 };

const xc = (uF: number) => 1e6 / (2 * Math.PI * DEFAULT_INPUTS.frequencyHz * uF);

/** Equations for the Detailed level. */
function Maths({ method }: { method: MethodId }) {
  switch (method) {
    case 'split-phase':
      return (
        <>
          <Eq block>{'θ_{main} = tan⁻¹(X_{main} / R_{main}),   θ_{aux} = tan⁻¹(X_{aux} / R_{aux})'}</Eq>
          <Eq block>{'displacement = θ_{main} − θ_{aux}'}</Eq>
          <p>
            A large <Eq>{'R_{aux}'}</Eq> makes <Eq>{'θ_{aux}'}</Eq> small, but the main winding’s angle is large, so the difference is only some 20–30°. The full model also couples the windings through the rotor, so the displacement it reports above differs a little from this two-branch estimate.
          </p>
        </>
      );
    case 'capacitor-start':
      return (
        <>
          <Eq block>{`X_C = 1 / (2π f C) = ${fmt(xc(CAP_UF.start), 1)} Ω   (${CAP_UF.start} µF, ${DEFAULT_INPUTS.frequencyHz} Hz)`}</Eq>
          <Eq block>{'θ_{aux} = tan⁻¹((X_{aux} − X_C) / R_{aux})   (negative: the current leads the voltage)'}</Eq>
          <p>
            When <Eq>X_C</Eq> is larger than the winding’s own reactance the auxiliary branch is capacitive. Together with the lagging main current this brings the displacement close to 90°. A larger capacitance means a smaller <Eq>X_C</Eq>, and a displacement that moves away from 90° again, so there is an optimum value.
          </p>
        </>
      );
    case 'psc':
      return (
        <>
          <Eq block>{`X_C = 1 / (2π f C) = ${fmt(xc(CAP_UF.run), 0)} Ω   (${CAP_UF.run} µF, ${DEFAULT_INPUTS.frequencyHz} Hz)`}</Eq>
          <p>
            The small run capacitor has a large reactance, so the auxiliary current at standstill is small and its angle is not the ideal one. At the running speed the rotor reflects a different impedance into both windings and the displacement moves close to 90°. The capacitor is chosen for that running condition.
          </p>
        </>
      );
    case 'cscr':
      return (
        <>
          <Eq block>{`C_{start phase} = C_{start} + C_{run} = ${CAP_UF.start} + ${CAP_UF.run} µF,   C_{run phase} = C_{run} = ${CAP_UF.run} µF`}</Eq>
          <p>
            Capacitors in parallel add. Because the two capacitors see the same voltage, the auxiliary current divides between them in proportion to their capacitance: the start capacitor carries most of it while the switch is closed, which is why it is the one that overheats.
          </p>
        </>
      );
    case 'shaded-pole':
      return (
        <>
          <Eq block>{'T_{start} ∝ Φ_u Φ_s sin δ_{time} sin δ_{space}'}</Eq>
          <p>
            The same rule as for two windings in Section 3: both the time lag <Eq>{'δ_{time}'}</Eq> (from the ring) and the spatial displacement <Eq>{'δ_{space}'}</Eq> between the unshaded and shaded parts must be non-zero, and the shaded flux <Eq>Φ_s</Eq> is smaller than <Eq>Φ_u</Eq>. That is why the starting torque is small.
          </p>
        </>
      );
  }
}

export default function Starting() {
  const { takeHandoff, navigate } = useApp();
  const [method, setMethod] = useState<MethodId>('capacitor-start');
  const [view, setView] = useState<'start' | 'run'>('start');
  const [part, setPart] = useState<PartKey | null>(null);
  const [load, setLoad] = useState(DEFAULT_LOAD);

  // Arrive from another section with a method already chosen (consumed once; safe under StrictMode).
  useEffect(() => {
    const id = takeHandoff()?.starting;
    if (isMethodId(id)) setMethod(id);
  }, [takeHandoff]);

  const choose = (m: MethodId) => {
    setMethod(m);
    setPart(null);
  };
  const resetView = () => {
    setView('start');
    setPart(null);
  };

  const deferredLoad = useDeferredValue(load);
  const stale = deferredLoad !== load;
  const cmp = useMemo<Result | { error: string }>(() => {
    try {
      return compareMethods({ loadTorque: deferredLoad });
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferredLoad]);

  const m = METHOD_BY_ID[method];
  const res = 'methods' in cmp && method !== 'shaded-pole' ? cmp.methods.find((r) => r.id === method) : undefined;
  const solution = res ? (view === 'start' ? res.start : res.run) : null;
  const mainA = solution ? Math.hypot(solution.iMain.re, solution.iMain.im) : 0;
  const auxA = solution ? Math.hypot(solution.iAux.re, solution.iAux.im) : 0;
  const readings: Reading[] =
    solution && res
      ? [
          { label: 'Main winding current', value: fmt(mainA, 1), unit: 'A' },
          { label: 'Auxiliary winding current', value: fmt(auxA, 1), unit: 'A', hint: auxA < 1e-6 ? 'Disconnected' : undefined },
          { label: 'Auxiliary leads main by', term: 'phaseDisplacement', value: auxA < 1e-6 ? '–' : fmt(solution.auxLeadDeg, 0), unit: auxA < 1e-6 ? undefined : '°', hint: auxA < 1e-6 ? undefined : 'The ideal is 90°' },
          { label: 'Line current', value: fmt(lineCurrent(solution), 1), unit: 'A' },
          view === 'start'
            ? { label: 'Standstill torque', term: 'startingTorque', value: fmt(solution.torqueNet, 2), unit: 'N·m', hint: `Load ${fmt('methods' in cmp ? cmp.loadTorque : null, 2)} N·m` }
            : { label: 'Running speed', value: fmt(res.runSpeedRpm, 0), unit: 'rpm', hint: 'Where the running curve meets the load' },
        ]
      : [];

  const openLab = (patch: Partial<LabInputs>) => navigate('lab', { lab: patch });
  // The hand-off bypasses the lab's own 0.3 N·m limit for PSC, so choose the load here.
  const labPatch = (id: 'split-phase' | 'capacitor-start' | 'psc'): Partial<LabInputs> => ({ ...methodDefaults(id), loadTorque: id === 'psc' ? Math.min(deferredLoad, 0.3) : deferredLoad });

  const labButtons: ReactNode = (() => {
    if (m.id === 'shaded-pole')
      return (
        <button type="button" className="btn" onClick={() => navigate('field', { field: { mode: 'twoWinding', inputs: SHADED_FIELD } })}>
          See a weak, unequal two-flux field in Section 3 →
        </button>
      );
    if (m.id === 'cscr')
      return (
        <div className="row">
          <button type="button" className="btn" onClick={() => openLab(labPatch('capacitor-start'))}>
            Starting half (capacitor-start) in the Physics lab →
          </button>
          <button type="button" className="btn" onClick={() => openLab(labPatch('psc'))}>
            Running half (PSC) in the Physics lab →
          </button>
        </div>
      );
    return (
      <button type="button" className="btn" onClick={() => openLab(labPatch(m.id as 'split-phase' | 'capacitor-start' | 'psc'))}>
        Try this motor in the Physics lab →
      </button>
    );
  })();

  const typical: Reading[] = [
    { label: 'Starting torque', value: m.typical.startTorque },
    { label: 'Starting current', value: m.typical.startCurrent },
    { label: 'Running power factor', value: m.typical.powerFactor },
    { label: 'Cost', value: m.typical.cost },
    { label: 'Typical size', value: m.typical.size },
    { label: 'Reversing', value: m.typical.reversing },
  ];

  return (
    <Page id="starting">
      <ModelBadge kinds={['illustration', 'analytical', 'numerical', 'qualitative']}>
        Circuit diagrams and the shaded-pole picture are illustrations. Numbers for split-phase, capacitor-start and PSC come from the same equivalent circuit as the Physics lab. CSCR is analytical only, shaded-pole is qualitative, and “typical” ranges are textbook rules of thumb.
      </ModelBadge>

      <section className="panel starting-intro" aria-label="Why motors need a starting method">
        <p>{STARTING_INTRO}</p>
        <Beginner>
          <p className="muted">
            Picture a merry-go-round. One person pushing it back and forth in a straight line makes it shake but not turn. Add a second person a quarter of the way round the ring who pushes a quarter of a cycle later, and the ride starts to spin. The auxiliary winding is the second person. The resistance, the capacitor or the shading ring decides how late the second push comes.
          </p>
        </Beginner>
        <button type="button" className="btn" onClick={() => navigate('field', { field: { mode: 'twoWinding' } })}>
          See the rotating field this makes (Section 3) →
        </button>
      </section>

      <div className="method-picker">
        <Segmented label="Choose a starting method" options={STARTING_METHODS.map((x) => ({ value: x.id, label: x.short, title: x.title }))} value={method} onChange={choose} />
      </div>

      <section className="panel" aria-labelledby="method-h">
        <div className="panel-head">
          <div>
            <h2 id="method-h">{m.title}</h2>
            <p className="muted method-tagline">{m.tagline}</p>
          </div>
          <ResetButton onClick={resetView} label="Reset diagram" />
        </div>

        <div className="method-layout">
          <div className="method-view">
            {m.id === 'shaded-pole' ? (
              <ShadedPole selected={part} onSelect={setPart} />
            ) : (
              <>
                <Segmented
                  label="Show the circuit"
                  options={[
                    { value: 'start', label: 'At standstill' },
                    { value: 'run', label: m.switched ? 'Running (switch open)' : 'Running' },
                  ]}
                  value={view}
                  onChange={setView}
                />
                <CircuitDiagram
                  method={m.id as CircuitMethod}
                  closed={view === 'start'}
                  currents={solution ? { main: mainA, aux: auxA, leadDeg: solution.auxLeadDeg } : null}
                  values={VALUES}
                  selected={part}
                  onSelect={setPart}
                />
              </>
            )}
            {m.id !== 'shaded-pole' && <PartCard part={part} onClose={() => setPart(null)} />}
            {m.id !== 'shaded-pole' && (
              <div className={`phasor-row${stale ? ' is-stale' : ''}`}>
                {solution ? (
                  <>
                    <figure className="phasor-fig">
                      <PhasorMini main={solution.iMain} aux={auxA > 1e-6 ? solution.iAux : null} />
                      <figcaption className="muted small">Phasors: voltage V is the reference.</figcaption>
                    </figure>
                    <div className="phasor-readouts">
                      <Readouts items={readings} label="Currents and torque for the circuit shown" />
                      <p className="muted small">Example motor at {fmt('methods' in cmp ? cmp.loadTorque : null, 2)} N·m load (set in “Compare the methods”).</p>
                    </div>
                  </>
                ) : (
                  <p className="state state-note" role="status">
                    {'error' in cmp ? cmp.error : 'At this load the running torque curve cannot carry the load: it exceeds the breakdown torque. Lower the load in “Compare the methods”.'}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="method-text">
            <h3>How it works</h3>
            <p>{m.principle}</p>
            <Detailed>
              <Maths method={m.id} />
            </Detailed>
            <h3>Step by step</h3>
            <ol className="steps">
              {m.sequence.map((s) => (
                <li key={s}>
                  <Rich>{s}</Rich>
                </li>
              ))}
            </ol>
            <Callout tone="tip" title="What to look for">
              <p>{m.lookFor}</p>
            </Callout>
            {m.note && <p className="muted small">{m.note}</p>}
            <div className="stack">{labButtons}</div>
          </div>
        </div>

        <div className="grid-3 method-lists">
          <div>
            <h3>Strengths</h3>
            <ul>
              {m.strengths.map((s) => (
                <li key={s}>
                  <Rich>{s}</Rich>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Limits</h3>
            <ul>
              {m.limits.map((s) => (
                <li key={s}>
                  <Rich>{s}</Rich>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Typical uses</h3>
            <ul>
              {m.uses.map((s) => (
                <li key={s}>
                  <Rich>{s}</Rich>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <h3>Typical characteristics (textbook, varies by design)</h3>
        <div className="kv-text">
          <Readouts items={typical} label={`Typical characteristics of a ${m.short} motor`} />
        </div>
      </section>

      <StartTransition onOpenLab={openLab} />

      <Comparison cmp={cmp} load={load} onLoad={setLoad} onResetLoad={() => setLoad(DEFAULT_LOAD)} stale={stale} selected={method} onSelect={choose} />

      <Callout tone="safety" title="Capacitors can hold a dangerous charge">
        <p>
          A motor capacitor can stay charged for a long time after the motor is switched off and can give a painful or dangerous shock. This app is a simulation. On a real motor, only a qualified person should isolate it, wait, and discharge the capacitor through a proper resistor before touching it.
        </p>
      </Callout>
    </Page>
  );
}
