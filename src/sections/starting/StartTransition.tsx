import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { NumberSlider, ResetButton, Segmented } from '../../components/Controls';
import { LineChart, type Series } from '../../components/LineChart';
import { Readouts, type Reading } from '../../components/Readouts';
import { fmt } from '../../components/format';
import type { PartKey } from '../../content/startingMethods';
import { useAnimationFrame } from '../../hooks/useAnimationFrame';
import { useApp } from '../../state';
import { operatingPoint } from '../../simulations/dynamics';
import { OUTCOME_TEXT, lineCurrent, summarize, type LabSummary } from '../../simulations/metrics';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, LIMITS, methodDefaults, radPerSecToRpm, validateInputs, type LabInputs } from '../../simulations/motorModel';
import { auxBands, thin } from '../lab/LabCharts';
import { CircuitDiagram } from './CircuitDiagram';
import { PartCard } from './Part';

type StartKind = 'capacitor-start' | 'split-phase';
interface Setup {
  kind: StartKind;
  capUF: number;
  auxR: number;
  load: number;
  /** Switch cut-out speed as a fraction of synchronous speed. */
  cutout: number;
}
const DEFAULT_SETUP: Setup = { kind: 'capacitor-start', capUF: methodDefaults('capacitor-start').capacitanceUF ?? 150, auxR: DEFAULT_INPUTS.auxResistance, load: DEFAULT_INPUTS.loadTorque, cutout: DEFAULT_INPUTS.cutoutFraction };

/** Seconds of motion shown; a motor that hunts around the switch speed would otherwise run for the whole 12 s of the simulation. */
const MAX_SHOW = 3;
const RATES = [
  { value: 0.1, label: '0.1×' },
  { value: 0.03, label: '0.03×' },
  { value: 1, label: '1×' },
];

interface Playback {
  t: number[];
  rpm: number[];
  torque: number[];
  auxOn: boolean[];
  line: number[];
  main: number[];
  aux: number[];
  lead: number[];
  tEnd: number;
  /** First time the switch opens, if it does. */
  tSwitch: number | null;
}

function buildPlayback(s: LabSummary): Playback {
  const tr = s.startup.trajectory;
  let n = tr.t.findIndex((x) => x > MAX_SHOW);
  if (n < 0) n = tr.t.length;
  const pb: Playback = { t: [], rpm: [], torque: [], auxOn: [], line: [], main: [], aux: [], lead: [], tEnd: 0, tSwitch: null };
  for (let i = 0; i < n; i++) {
    const sol = operatingPoint(s.inputs, s.motor, tr.omega[i], tr.auxOn[i]);
    pb.t.push(tr.t[i]);
    pb.rpm.push(radPerSecToRpm(tr.omega[i]));
    pb.torque.push(tr.torque[i]);
    pb.auxOn.push(tr.auxOn[i]);
    pb.line.push(lineCurrent(sol));
    pb.main.push(Math.hypot(sol.iMain.re, sol.iMain.im));
    pb.aux.push(Math.hypot(sol.iAux.re, sol.iAux.im));
    pb.lead.push(sol.auxLeadDeg);
    if (pb.tSwitch === null && i > 0 && tr.auxOn[i - 1] && !tr.auxOn[i]) pb.tSwitch = tr.t[i];
  }
  pb.tEnd = pb.t[pb.t.length - 1] ?? 0;
  return pb;
}

/** Index of the last sample at or before time t. */
function indexAt(ts: number[], t: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

function narrate(s: LabSummary, pb: Playback, i: number): string {
  const cap = s.inputs.method === 'capacitor-start';
  const nsRpm = s.nsRpm;
  const pct = (100 * Math.abs(pb.rpm[i])) / nsRpm;
  const t = pb.t[i];
  if (s.startup.outcome === 'no-start' && pb.rpm[i] < 1)
    return `The rotor does not move. The standstill torque (${fmt(s.startTorque, 2)} N·m) is below the load torque (${fmt(s.inputs.loadTorque, 2)} N·m), so the motor only hums and draws ${fmt(pb.line[i], 1)} A. Raise the capacitor or lower the load.`;
  if (i === 0 && pb.auxOn[0])
    return `Switch-on. The rotor is at rest, so the switch is closed and the ${cap ? 'capacitor and ' : ''}auxiliary winding are in circuit. The two winding currents are ${fmt(pb.lead[0], 0)}° apart in time, which makes a rotating field and a starting torque of ${fmt(s.startTorque, 2)} N·m.`;
  if (pb.tSwitch !== null && t >= pb.tSwitch && t - pb.tSwitch < 0.08)
    return `The switch has just opened at ${fmt(s.inputs.cutoutFraction * 100, 0)} % of synchronous speed. The auxiliary winding${cap ? ' and the capacitor are' : ' is'} disconnected: that current drops to zero and the line current falls, while the motor keeps accelerating on the main winding alone.`;
  if (pb.auxOn[i]) return `Accelerating with the start circuit in. The rotor is at ${fmt(pct, 0)} % of synchronous speed; the switch will open at ${fmt(s.inputs.cutoutFraction * 100, 0)} %.`;
  if (s.startup.outcome === 'settles' && t >= (s.startup.timeToSettle ?? Infinity)) return `Steady running at ${fmt(pb.rpm[i], 0)} rpm on the main winding alone. Motor torque equals the load torque.`;
  return `Running on the main winding alone (${fmt(pct, 0)} % of synchronous speed), still accelerating toward the speed where motor torque equals load torque.`;
}

export default function StartTransition({ onOpenLab }: { onOpenLab: (patch: Partial<LabInputs>) => void }) {
  const { motionOn } = useApp();
  const [setup, setSetup] = useState<Setup>(DEFAULT_SETUP);
  const [rate, setRate] = useState(0.1);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState<PartKey | null>(null);

  const deferred = useDeferredValue(setup);
  const stale = deferred !== setup;
  const inputs = useMemo<LabInputs>(
    () => validateInputs({ ...DEFAULT_INPUTS, method: deferred.kind, capacitanceUF: deferred.capUF, auxResistance: deferred.auxR, loadTorque: deferred.load, cutoutFraction: deferred.cutout }).inputs,
    [deferred],
  );
  const model = useMemo<{ s: LabSummary; pb: Playback } | { error: string }>(() => {
    try {
      const s = summarize(inputs, EXAMPLE_MOTOR);
      return { s, pb: buildPlayback(s) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [inputs]);

  // a new set-up starts from the beginning
  useEffect(() => {
    setT(0);
    setPlaying(true);
  }, [inputs]);

  const tEnd = 's' in model ? model.pb.tEnd : 0;
  useAnimationFrame((dt) => setT((x) => Math.min(tEnd, x + dt * rate)), playing && motionOn && t < tEnd);

  const patch = (p: Partial<Setup>) => setSetup((v) => ({ ...v, ...p }));
  const reset = () => {
    setSetup(DEFAULT_SETUP);
    setRate(0.1);
    setSelected(null);
    setT(0);
    setPlaying(true);
  };

  const series = useMemo(() => {
    if (!('s' in model)) return null;
    const { s, pb } = model;
    const idx = thin(pb.t.map((_, i) => i), 300);
    const col = (a: number[]) => idx.map((i) => [pb.t[i], a[i]] as const);
    const speed: Series[] = [{ id: 'speed', label: 'Rotor speed', color: '#7db0ff', width: 2.6, points: col(pb.rpm) }];
    const current: Series[] = [
      { id: 'line', label: 'Line current', color: '#e9eff7', width: 2.6, points: col(pb.line) },
      { id: 'main', label: 'Main winding', color: '#46c8b2', width: 2, dash: '2 4', points: col(pb.main) },
      { id: 'aux', label: 'Auxiliary winding', color: '#f2a93b', width: 2, dash: '9 5', points: col(pb.aux) },
    ];
    return { speed, current, bands: auxBands(pb.t, pb.auxOn), nsRpm: s.nsRpm };
  }, [model]);

  if ('error' in model) {
    return (
      <section className="panel" aria-labelledby="transition-h">
        <h2 id="transition-h">Watch a start-up</h2>
        <div className="state state-error" role="alert">
          <h3>These settings could not be solved</h3>
          <p>{model.error}</p>
          <button type="button" className="btn" onClick={reset}>
            Reset the start-up
          </button>
        </div>
      </section>
    );
  }

  const { s, pb } = model;
  const i = indexAt(pb.t, t);
  const outcome = OUTCOME_TEXT[s.startup.outcome];
  const closed = pb.auxOn[i];
  const items: Reading[] = [
    { label: 'Time', value: fmt(pb.t[i], 3), unit: 's', hint: rate === 1 ? 'Real time' : `Shown ${fmt(1 / rate, 0)}× slower than real` },
    { label: 'Speed', value: fmt(pb.rpm[i], 0), unit: 'rpm', hint: `${fmt((100 * pb.rpm[i]) / s.nsRpm, 0)} % of synchronous` },
    { label: 'Start switch', value: closed ? 'Closed' : 'Open', hint: closed ? 'Start circuit connected' : 'Start circuit disconnected', tone: closed ? undefined : 'ok' },
    { label: 'Motor torque', term: 'torque', value: fmt(pb.torque[i], 2), unit: 'N·m', hint: `Load ${fmt(s.inputs.loadTorque, 2)} N·m` },
    { label: 'Line current', value: fmt(pb.line[i], 1), unit: 'A' },
    { label: 'Main / auxiliary', value: `${fmt(pb.main[i], 1)} / ${fmt(pb.aux[i], 1)}`, unit: 'A', hint: pb.aux[i] > 1e-6 ? `Aux leads by ${fmt(pb.lead[i], 0)}°` : 'Auxiliary branch open' },
  ];

  return (
    <section className={`panel transition${stale ? ' is-stale' : ''}`} aria-labelledby="transition-h" aria-busy={stale}>
      <div className="panel-head">
        <h2 id="transition-h">Watch a start-up</h2>
        <ResetButton onClick={reset} label="Reset start-up" />
      </div>
      <p className="muted">
        The motor is switched on at rest. Press play, or drag the time slider, and watch the switch open at about {fmt(s.inputs.cutoutFraction * 100, 0)} % of synchronous speed. The real start takes only a fraction of a second, so it is slowed down.
      </p>
      <div className="transition-layout">
        <div className="transition-controls">
          <Segmented
            label="Start circuit"
            options={[
              { value: 'capacitor-start', label: 'Capacitor-start' },
              { value: 'split-phase', label: 'Split-phase' },
            ]}
            value={setup.kind}
            onChange={(kind) => patch({ kind })}
          />
          <div className="spacer" />
          {setup.kind === 'capacitor-start' ? (
            <NumberSlider label="Start capacitor" term="capacitor" value={setup.capUF} min={LIMITS.capacitanceUF.min} max={LIMITS.capacitanceUF.max} step={LIMITS.capacitanceUF.step} unit="µF" onChange={(capUF) => patch({ capUF })} />
          ) : (
            <NumberSlider label="Auxiliary-branch resistance" value={setup.auxR} min={LIMITS.auxResistance.min} max={LIMITS.auxResistance.max} step={LIMITS.auxResistance.step} unit="Ω" onChange={(auxR) => patch({ auxR })} />
          )}
          <NumberSlider label="Load torque" term="loadTorque" value={setup.load} min={LIMITS.loadTorque.min} max={LIMITS.loadTorque.max} step={LIMITS.loadTorque.step} unit="N·m" decimals={2} onChange={(load) => patch({ load })} />
          <NumberSlider label="Switch opens at" term="centrifugalSwitch" value={Math.round(setup.cutout * 100)} min={Math.round(LIMITS.cutoutFraction.min * 100)} max={Math.round(LIMITS.cutoutFraction.max * 100)} step={1} unit="% Ns" onChange={(v) => patch({ cutout: v / 100 })} />
          <Segmented label="Playback speed (× real time)" options={RATES} value={rate} onChange={setRate} />
          <p className="ctl-hint">Other settings are the Physics-lab defaults (120 V, 60 Hz, 4 poles).</p>
          <button type="button" className="btn" onClick={() => onOpenLab({ ...methodDefaults(deferred.kind), capacitanceUF: deferred.capUF, auxResistance: deferred.auxR, loadTorque: deferred.load, cutoutFraction: deferred.cutout })}>
            Open this start in the Physics lab →
          </button>
        </div>

        <div className="transition-view">
          <p className="row">
            <span className={`pill pill-${outcome.tone}`}>{outcome.label}</span>
            <span className="muted small">{outcome.detail}</span>
          </p>
          <p className="narration" role="status" aria-live="off">
            {narrate(s, pb, i)}
          </p>
          <CircuitDiagram
            method={deferred.kind}
            closed={closed}
            currents={{ main: pb.main[i], aux: pb.aux[i], leadDeg: pb.lead[i] }}
            values={{ voltage: s.inputs.voltage, frequencyHz: s.inputs.frequencyHz, startUF: s.inputs.capacitanceUF, runUF: 0, auxR: s.inputs.auxResistance }}
            selected={selected}
            onSelect={setSelected}
          />
          <PartCard part={selected} onClose={() => setSelected(null)} />
          <div className="transport">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!motionOn}
              title={motionOn ? undefined : 'Animations are paused (top bar). Drag the time slider instead.'}
              onClick={() => {
                if (t >= tEnd) setT(0);
                setPlaying(t >= tEnd ? true : !playing);
              }}
            >
              {t >= tEnd ? '↺ Replay' : playing && motionOn ? '❚❚ Pause' : '▶ Play'}
            </button>
            <NumberSlider
              label="Time"
              value={Math.min(t, tEnd)}
              min={0}
              max={tEnd}
              step={0.005}
              unit="s"
              decimals={3}
              onChange={(v) => {
                setPlaying(false);
                setT(v);
              }}
            />
          </div>
          {!motionOn && <p className="muted small">Animations are paused in the top bar, so playback is off. Dragging the time slider still works.</p>}
        </div>
      </div>

      <Readouts items={items} label="Values at the time shown" />

      {series && (
        <div className="grid-2 transition-charts">
          <LineChart
            title="Speed against time"
            desc="Rotor speed after switch-on. Hatched bands show when the start circuit is connected. A vertical marker follows the time shown."
            series={series.speed}
            bands={series.bands}
            hLines={[
              { value: series.nsRpm, label: 'Synchronous speed', color: '#e9eff7', dash: '3 4' },
              { value: s.inputs.cutoutFraction * series.nsRpm, label: 'Switch opens', color: '#f2a93b', dash: '6 4' },
            ]}
            xDomain={[0, Math.max(0.1, pb.tEnd)]}
            xLabel="Time (s)"
            yLabel="Speed (rpm)"
            includeZeroY
            height={260}
            cursorX={pb.t[i]}
          />
          <LineChart
            title="Currents against time"
            desc="Line current and the two winding currents. The auxiliary current stops, and the line current falls, when the switch opens."
            series={series.current}
            bands={series.bands}
            xDomain={[0, Math.max(0.1, pb.tEnd)]}
            xLabel="Time (s)"
            yLabel="Current (A rms)"
            includeZeroY
            height={260}
            cursorX={pb.t[i]}
          />
        </div>
      )}
    </section>
  );
}
