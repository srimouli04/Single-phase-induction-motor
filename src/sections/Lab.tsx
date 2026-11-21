import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { Callout, ModelBadge } from '../components/Badges';
import { Segmented, Toggle } from '../components/Controls';
import { useApp } from '../state';
import { summarize, turnsInReverse, type LabSummary } from '../simulations/metrics';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, methodDefaults, validateInputs, type LabInputs, type StartMethod } from '../simulations/motorModel';
import { LabControls } from './lab/LabControls';
import { LabCharts } from './lab/LabCharts';
import { LabFormulas, LabReadouts, ModelDetails } from './lab/LabPanels';

/** Plain-language next steps when the motor does not simply start and run. */
function suggestions(s: LabSummary): string[] {
  const { inputs, startup } = s;
  const out: string[] = [];
  const circuit = inputs.method !== 'main-only';
  if (startup.outcome === 'settles' && inputs.switchFault !== 'stuck-closed' && !inputs.rotorLocked) return out;
  if (inputs.rotorLocked) out.push('The rotor is locked, so it cannot turn. Note how high the standstill current is: this is the current a jammed motor draws until its protector trips.');
  if (inputs.method === 'main-only' && startup.outcome === 'no-start') out.push('A single winding makes a pulsating field and zero starting torque. Raise "Initial speed" to give the shaft a push, or choose a starting method.');
  if (circuit && inputs.auxOpen) out.push('The auxiliary branch is open, so the motor behaves like a main-winding-only motor and cannot start by itself.');
  if (circuit && inputs.switchFault === 'stuck-open' && inputs.method !== 'psc') out.push('The centrifugal switch is stuck open, so the start circuit never connects at standstill.');
  if (inputs.switchFault === 'stuck-closed' && inputs.method !== 'psc' && circuit) out.push('The switch is stuck closed: the start circuit stays connected while running. Compare the running current and winding loss with the "Normal" setting.');
  if (circuit && !inputs.auxOpen && inputs.switchFault !== 'stuck-open' && !inputs.rotorLocked && (startup.outcome === 'no-start' || startup.outcome === 'stalls')) {
    out.push(`The starting torque (${s.startTorque.toFixed(2)} N·m) is not enough for this load (${inputs.loadTorque.toFixed(2)} N·m). Lower the load, raise the voltage, or adjust the capacitor or resistor.`);
  }
  if (startup.outcome === 'cycles') out.push('The start circuit keeps cutting out and back in. Lower the load, or move the switch speed so that the motor still has torque after the switch opens.');
  if (startup.outcome === 'slow') out.push('The motor was still accelerating when the simulation ended. Reduce the inertia or load.');
  return out;
}

export default function Lab() {
  const { takeHandoff } = useApp();
  const [inputs, setInputs] = useState<LabInputs>(DEFAULT_INPUTS);
  const [startFraction, setStartFraction] = useState(0);
  const [issues, setIssues] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [showReverse, setShowReverse] = useState(false);
  const [showComponents, setShowComponents] = useState(false);
  const [waveAt, setWaveAt] = useState<'start' | 'run'>('run');

  // Pick up a configuration handed over by a guided experiment (consumed once; safe under StrictMode).
  useEffect(() => {
    const h = takeHandoff();
    if (!h || (!h.lab && h.labSpin === undefined)) return;
    const r = validateInputs({ ...DEFAULT_INPUTS, ...h.lab });
    setInputs(r.inputs);
    setIssues(r.issues);
    setStartFraction(h.labSpin ?? 0);
  }, [takeHandoff]);

  const apply = (patch: Partial<LabInputs>) => {
    const r = validateInputs({ ...inputs, ...patch });
    setInputs(r.inputs);
    setIssues(r.issues);
    setNote('');
  };
  const changeMethod = (m: StartMethod) => {
    const patch: Partial<LabInputs> = methodDefaults(m);
    let message = '';
    if (m === 'psc' && inputs.loadTorque > 0.3) {
      patch.loadTorque = 0.3;
      message = 'Load lowered to 0.3 N·m: permanent-split-capacitor motors have low starting torque and suit light loads.';
    }
    const r = validateInputs({ ...inputs, ...patch });
    setInputs(r.inputs);
    setIssues(r.issues);
    setNote(message);
  };
  const reset = () => {
    setInputs(DEFAULT_INPUTS);
    setStartFraction(0);
    setIssues([]);
    setNote('');
  };

  const deferred = useDeferredValue(inputs);
  const deferredStart = useDeferredValue(startFraction);
  const stale = deferred !== inputs || deferredStart !== startFraction;
  const result = useMemo<{ s: LabSummary } | { error: string }>(() => {
    try {
      return { s: summarize(deferred, EXAMPLE_MOTOR, { startFraction: deferredStart }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred, deferredStart]);
  const tips = 's' in result ? suggestions(result.s) : [];
  const reversed = 's' in result && turnsInReverse(result.s);

  return (
    <Page id="lab">
      <ModelBadge kinds={['analytical', 'numerical']}>
        Torque, current and power come from an equivalent-circuit model; the speed-time curve is a numerical integration. The parameters are illustrative, not a datasheet.
      </ModelBadge>
      <div className="lab-layout">
        <aside className="lab-side" aria-label="Simulation controls">
          <LabControls inputs={inputs} onChange={apply} onMethod={changeMethod} onReset={reset} startFraction={startFraction} onStartFraction={setStartFraction} issues={issues} />
        </aside>

        <div className={`lab-main${stale ? ' is-stale' : ''}`} aria-busy={stale}>
          {note && (
            <p className="state state-note" role="status">
              {note}
            </p>
          )}
          {'error' in result ? (
            <div className="state state-error" role="alert">
              <h3>These settings could not be solved</h3>
              <p>{result.error}</p>
              <button type="button" className="btn" onClick={reset}>
                Reset to the default motor
              </button>
            </div>
          ) : (
            <>
              <LabReadouts s={result.s} />
              {tips.length > 0 && (
                <Callout tone="tip" title="What is happening, and what to try">
                  <ul>
                    {tips.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </Callout>
              )}
              <section className="panel" aria-labelledby="graphs-h">
                <div className="panel-head">
                  <h2 id="graphs-h">Graphs</h2>
                  <div className="row">
                    <Toggle label={reversed ? 'Show reverse speeds (the motor is turning in reverse)' : 'Show reverse speeds'} checked={showReverse || reversed} disabled={reversed} onChange={setShowReverse} />
                    <Toggle label="Show forward and backward field torques" checked={showComponents} onChange={setShowComponents} />
                    <Segmented
                      label="Winding currents at"
                      options={[
                        { value: 'start', label: 'Standstill' },
                        { value: 'run', label: 'Operating speed' },
                      ]}
                      value={waveAt}
                      onChange={setWaveAt}
                    />
                  </div>
                </div>
                <LabCharts s={result.s} showReverse={showReverse} showComponents={showComponents} waveAt={waveAt} />
              </section>
              <LabFormulas s={result.s} />
            </>
          )}
          <ModelDetails />
        </div>
      </div>
    </Page>
  );
}
