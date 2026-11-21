// Side-by-side comparison of the starting methods on the SAME equivalent circuit as the Physics lab.
// Split-phase, capacitor-start and PSC also get the lab's simulated start-up. CSCR is ANALYTICAL ONLY: the standstill point with
// C_start + C_run in circuit and the PSC curve (C_run) for running. Its switch-over is not simulated, so no start / stall claim is made.
import {
  DEFAULT_INPUTS,
  EXAMPLE_MOTOR,
  breakdownTorque,
  methodDefaults,
  solveAtSpeed,
  syncOmega,
  synchronousSpeedRpm,
  validateInputs,
  type Electrical,
  type LabInputs,
  type MotorParams,
  type Solution,
} from './motorModel.ts';
import { summarize, type LabSummary } from './metrics.ts';

export type CompareId = 'split-phase' | 'capacitor-start' | 'psc' | 'cscr';
export const COMPARE_IDS: readonly CompareId[] = ['split-phase', 'capacitor-start', 'psc', 'cscr'];
export const COMPARE_LABEL: Record<CompareId, string> = { 'split-phase': 'Split-phase', 'capacitor-start': 'Capacitor-start', psc: 'PSC', cscr: 'CSCR' };

/** Capacitor-start value and PSC (run) value of the example motor; a CSCR motor has both. */
export const CAP_UF = { start: methodDefaults('capacitor-start').capacitanceUF ?? 150, run: methodDefaults('psc').capacitanceUF ?? 25 };

export interface CompareOptions {
  /** Constant load torque [N.m]. */
  loadTorque: number;
  /** Centrifugal switch cut-out speed as a fraction of synchronous speed. */
  cutoutFraction?: number;
}

export interface MethodResult {
  id: CompareId;
  /** Standstill solution with the start circuit connected. */
  start: Solution;
  /** Where the running torque curve meets the load (analytical). null when the load exceeds the breakdown torque. */
  run: Solution | null;
  runSpeedRpm: number | null;
  /** [rpm, N.m] along the path the motor takes: start curve up to the cut-out speed, running curve above it (a jump at the switch). */
  path: [number, number][];
  /** The lab's simulated start-up; null for CSCR (not simulated). */
  summary: LabSummary | null;
}

export interface Comparison {
  methods: MethodResult[];
  /** Main winding alone: the running curve of split-phase and capacitor-start, and the reference for every method. */
  mainOnly: [number, number][];
  nsRpm: number;
  cutoutRpm: number;
  /** Load torque the result was computed for [N.m] (after validation). */
  loadTorque: number;
}

/** Speed and solution where the falling side of the torque curve meets load + viscous friction. Analytical, no time stepping. */
export function runPoint(motor: MotorParams, net: Electrical, loadTorque: number, damping = 0): { solution: Solution; speedRpm: number } | null {
  const ns = synchronousSpeedRpm(net.frequencyHz, net.poles);
  const w = syncOmega(net.frequencyHz, net.poles);
  const g = (f: number) => solveAtSpeed(motor, net, f * w).torqueNet - (loadTorque + damping * f * w);
  let lo = breakdownTorque(motor, net).speedRpm / ns;
  let hi = 1;
  if (g(lo) < 0) return null;
  if (g(hi) >= 0) return { solution: solveAtSpeed(motor, net, w), speedRpm: ns };
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) >= 0) lo = mid;
    else hi = mid;
  }
  const f = (lo + hi) / 2;
  return { solution: solveAtSpeed(motor, net, f * w), speedRpm: f * ns };
}

/** Torque against speed along the path the motor takes. Two points share the cut-out speed: the jump when the start circuit drops out. */
export function pathCurve(motor: MotorParams, start: Electrical, run: Electrical, cutout: number, n = 120): [number, number][] {
  const ns = synchronousSpeedRpm(start.frequencyHz, start.poles);
  const w = syncOmega(start.frequencyHz, start.poles);
  const torque = (e: Electrical, f: number) => solveAtSpeed(motor, e, f * w).torqueNet;
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) if (i / n < cutout) out.push([(i / n) * ns, torque(start, i / n)]);
  out.push([cutout * ns, torque(start, cutout)]);
  out.push([cutout * ns, torque(run, cutout)]);
  for (let i = 0; i <= n; i++) if (i / n > cutout) out.push([(i / n) * ns, torque(run, i / n)]);
  return out;
}

export function compareMethods(opts: CompareOptions, motor: MotorParams = EXAMPLE_MOTOR): Comparison {
  const cutout = opts.cutoutFraction ?? DEFAULT_INPUTS.cutoutFraction;
  const base = validateInputs({ ...DEFAULT_INPUTS, loadTorque: opts.loadTorque, cutoutFraction: cutout }).inputs;
  const common = { voltage: base.voltage, frequencyHz: base.frequencyHz, poles: base.poles };
  const capNet = (uF: number): Electrical => ({ ...common, aux: { resistance: motor.r1a, capacitanceUF: uF } });
  const mainNet: Electrical = { ...common, aux: null };
  const nets: Record<CompareId, { start: Electrical; run: Electrical; switches: boolean }> = {
    'split-phase': { start: { ...common, aux: { resistance: base.auxResistance, capacitanceUF: 0 } }, run: mainNet, switches: true },
    'capacitor-start': { start: capNet(CAP_UF.start), run: mainNet, switches: true },
    psc: { start: capNet(CAP_UF.run), run: capNet(CAP_UF.run), switches: false },
    cscr: { start: capNet(CAP_UF.start + CAP_UF.run), run: capNet(CAP_UF.run), switches: true },
  };
  const inputsFor = (id: Exclude<CompareId, 'cscr'>): LabInputs => validateInputs({ ...base, ...methodDefaults(id) }).inputs;

  const methods = COMPARE_IDS.map<MethodResult>((id) => {
    const n = nets[id];
    const rp = runPoint(motor, n.run, base.loadTorque, base.damping);
    return {
      id,
      start: solveAtSpeed(motor, n.start, 0),
      run: rp?.solution ?? null,
      runSpeedRpm: rp?.speedRpm ?? null,
      path: pathCurve(motor, n.start, n.run, n.switches ? cutout : 1),
      summary: id === 'cscr' ? null : summarize(inputsFor(id), motor),
    };
  });
  const ns = synchronousSpeedRpm(base.frequencyHz, base.poles);
  return { methods, mainOnly: pathCurve(motor, mainNet, mainNet, 1), nsRpm: ns, cutoutRpm: cutout * ns, loadTorque: base.loadTorque };
}
