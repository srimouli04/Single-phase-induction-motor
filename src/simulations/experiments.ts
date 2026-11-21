// Measuring a guided experiment: run the Physics-lab model (or the idealised field model) once per configuration and
// collect the numbers the experiment tables show and its claims check. Pure: no React, no DOM.
import type { StartupOutcome } from './dynamics.ts';
import { MAIN_ONLY_FIELD, fieldTorques } from './field.ts';
import { lineCurrent, summarize } from './metrics.ts';
import { DEFAULT_INPUTS, hasStartCircuit, synchronousSpeedRpm, validateInputs, type LabInputs } from './motorModel.ts';

export type MetricId =
  | 'startTorque'
  | 'startCurrent'
  | 'auxStartCurrent'
  | 'leadDeg'
  | 'outcome'
  | 'speedRpm'
  | 'slipPct'
  | 'steadyCurrent'
  | 'efficiency'
  | 'breakdown'
  | 'forward'
  | 'backward'
  | 'net';

export const METRICS: Record<MetricId, { label: string; unit?: string; digits?: number }> = {
  startTorque: { label: 'Starting torque', unit: 'N·m', digits: 2 },
  startCurrent: { label: 'Starting current', unit: 'A', digits: 1 },
  auxStartCurrent: { label: 'Auxiliary current at start', unit: 'A', digits: 1 },
  leadDeg: { label: 'Auxiliary current leads main by', unit: '°', digits: 0 },
  outcome: { label: 'Result' },
  speedRpm: { label: 'Running speed', unit: 'rpm', digits: 0 },
  slipPct: { label: 'Slip', unit: '%', digits: 1 },
  steadyCurrent: { label: 'Steady current', unit: 'A', digits: 1 },
  efficiency: { label: 'Efficiency (estimate)', unit: '%', digits: 0 },
  breakdown: { label: 'Breakdown torque', unit: 'N·m', digits: 2 },
  forward: { label: 'Forward-field torque', unit: 'relative', digits: 3 },
  backward: { label: 'Backward-field torque', unit: 'relative', digits: 3 },
  net: { label: 'Net torque', unit: 'relative', digits: 3 },
};

export const OUTCOME_LABEL: Record<StartupOutcome, string> = {
  settles: 'Starts and settles',
  'no-start': 'Does not start',
  stalls: 'Stalls',
  cycles: 'Cycles on and off',
  slow: 'Still accelerating',
};

export type MetricValue = number | string | null;

/** One configuration of an experiment, measured. `null` means "not meaningful here" (shown as a dash). */
export interface Row {
  label: string;
  /** Raw start-up outcome for lab runs, null for field runs. */
  outcome: StartupOutcome | null;
  v: Partial<Record<MetricId, MetricValue>>;
}

export interface LabRun {
  label: string;
  patch: Partial<LabInputs>;
  /** Initial speed as a fraction of synchronous speed ("spin the shaft by hand"). */
  spin?: number;
}

/** Value of a numeric metric; throws when it is missing, so a broken claim fails loudly instead of quietly being false. */
export function num(r: Row, k: MetricId): number {
  const x = r.v[k];
  if (typeof x !== 'number') throw new TypeError(`"${r.label}" has no numeric ${k}.`);
  return x;
}

/** Run the Physics-lab model for one configuration. Throws if the patch needed repairing (the content is wrong, not the user). */
export function measureLab(run: LabRun): Row {
  const { inputs, issues } = validateInputs({ ...DEFAULT_INPUTS, ...run.patch });
  if (issues.length > 0) throw new RangeError(`Experiment run "${run.label}": ${issues.join(' ')}`);
  const s = summarize(inputs, undefined, { startFraction: run.spin });
  const st = s.startup;
  const settles = st.outcome === 'settles';
  // same rule as summarize(): is the auxiliary branch connected at standstill?
  const hasAux = hasStartCircuit(inputs) && (inputs.method === 'psc' || inputs.switchFault !== 'stuck-open');
  const rpmAbs = Math.abs(st.finalSpeedRpm);
  const ns = synchronousSpeedRpm(inputs.frequencyHz, inputs.poles);
  return {
    label: run.label,
    outcome: st.outcome,
    v: {
      startTorque: s.startTorque,
      startCurrent: s.startCurrent,
      auxStartCurrent: hasAux ? Math.hypot(s.start.iAux.re, s.start.iAux.im) : null,
      leadDeg: hasAux ? s.start.auxLeadDeg : null,
      outcome: OUTCOME_LABEL[st.outcome],
      // A steady speed only exists when the run settles; "cycles" and "slow" end at an arbitrary instant.
      speedRpm: settles ? st.finalSpeedRpm : st.outcome === 'no-start' ? 0 : null,
      slipPct: settles ? 100 * (1 - rpmAbs / ns) : null,
      steadyCurrent: settles || st.outcome === 'no-start' ? lineCurrent(s.run) : null,
      efficiency: settles && s.efficiency !== null ? 100 * s.efficiency : null,
      breakdown: s.breakdown.torque,
    },
  };
}

/** Torques of the idealised field model with the main winding only, for a rotor at fraction r of synchronous speed. */
export function measureField(label: string, r: number): Row {
  const t = fieldTorques(MAIN_ONLY_FIELD, r);
  return { label, outcome: null, v: { forward: t.forward, backward: t.backward, net: t.net } };
}

export function formatMetric(id: MetricId, value: MetricValue | undefined): string {
  if (value === null || value === undefined) return '–';
  if (typeof value === 'string') return value;
  const d = METRICS[id].digits ?? 2;
  return Math.abs(value) < 0.5 * 10 ** -d ? (0).toFixed(d) : value.toFixed(d); // no "-0.00"
}
