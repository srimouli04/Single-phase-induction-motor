// Rotor-speed dynamics:  J dw/dt = T_motor(w) - T_load - T_loss(w)   (RK4 on a pre-computed torque table).
// Pure functions only. The torque table is built from the exact phasor solution in motorModel.ts.
import {
  type Electrical,
  type LabInputs,
  type MotorParams,
  type Solution,
  EXAMPLE_MOTOR,
  SWITCH_HYSTERESIS,
  electricalFor,
  hasStartCircuit,
  radPerSecToRpm,
  solveAtSlip,
  solveAtSpeed,
  syncOmega,
} from './motorModel.ts';

// ---------------------------------------------------------------- torque table

export interface TorqueTable {
  omegaS: number;
  n: number; // intervals; samples are at omega_k = -omegaS + k * 2 omegaS / n
  main: Float64Array; // net torque, main winding only [N.m]
  aux: Float64Array | null; // net torque with the auxiliary branch connected (null if the motor has none)
  maxSlope: number; // largest |dT/domega| [N.m.s/rad], used to choose a stable time step
}

const TABLE_INTERVALS = 400;

export function buildTorqueTable(inputs: LabInputs, motor: MotorParams = EXAMPLE_MOTOR): TorqueTable {
  const n = TABLE_INTERVALS;
  const omegaS = syncOmega(inputs.frequencyHz, inputs.poles);
  const fill = (withAux: boolean): Float64Array => {
    const e = electricalFor(inputs, motor, withAux);
    const arr = new Float64Array(n + 1);
    for (let k = 0; k <= n; k++) arr[k] = solveAtSlip(motor, e, 2 - (2 * k) / n).torqueNet; // k=0: s=2 (-w_s); k=n: s=0 (+w_s)
    return arr;
  };
  const main = fill(false);
  const aux = hasStartCircuit(inputs) ? fill(true) : null;
  const dOmega = (2 * omegaS) / n;
  let maxSlope = 0;
  for (const arr of aux ? [main, aux] : [main]) {
    for (let k = 1; k <= n; k++) maxSlope = Math.max(maxSlope, Math.abs(arr[k] - arr[k - 1]) / dOmega);
  }
  return { omegaS, n, main, aux, maxSlope };
}

/** Linear interpolation; speed is clamped to the modelled range |w| <= w_s (no extrapolation). */
export function interpTorque(arr: Float64Array, t: TorqueTable, omega: number): number {
  const w = Math.min(t.omegaS, Math.max(-t.omegaS, omega));
  const x = ((w + t.omegaS) / (2 * t.omegaS)) * t.n;
  const i = Math.min(t.n - 1, Math.floor(x));
  const f = x - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}

// ---------------------------------------------------------------- switch + state

/** Centrifugal-switch behaviour with hysteresis. `true` = auxiliary branch connected. */
export function nextAuxState(auxOn: boolean, omega: number, omegaS: number, p: LabInputs): boolean {
  if (!hasStartCircuit(p)) return false;
  if (p.method === 'psc') return true; // permanent capacitor: no switch
  if (p.switchFault === 'stuck-open') return false;
  if (p.switchFault === 'stuck-closed') return true;
  const frac = Math.abs(omega) / omegaS;
  if (auxOn && frac >= p.cutoutFraction) return false;
  if (!auxOn && frac <= p.cutoutFraction - SWITCH_HYSTERESIS) return true;
  return auxOn;
}

export interface SimState {
  t: number; // s
  omega: number; // rad/s (negative = reverse)
  auxOn: boolean;
  energized: boolean; // supply connected
  toggles: number; // number of centrifugal-switch operations
}

export function initialState(p: LabInputs, omegaS: number, omega0 = 0, energized = true): SimState {
  const omega = p.rotorLocked ? 0 : Math.min(omegaS, Math.max(-omegaS, omega0));
  return { t: 0, omega, auxOn: nextAuxState(true, omega, omegaS, p), energized, toggles: 0 };
}

export function motorTorque(tbl: TorqueTable, auxOn: boolean, energized: boolean, omega: number): number {
  if (!energized) return 0;
  return interpTorque(auxOn && tbl.aux ? tbl.aux : tbl.main, tbl, omega);
}

const STICK_FRACTION = 0.004; // |w| below this fraction of w_s counts as standstill (static friction zone)

function acceleration(tbl: TorqueTable, p: LabInputs, auxOn: boolean, energized: boolean, omega: number): number {
  const tm = motorTorque(tbl, auxOn, energized, omega);
  const load = p.loadTorque;
  if (Math.abs(omega) < STICK_FRACTION * tbl.omegaS) {
    if (Math.abs(tm) <= load) return 0; // held by the load / static friction
    return (tm - Math.sign(tm) * load) / p.inertia;
  }
  return (tm - Math.sign(omega) * load - p.damping * omega) / p.inertia;
}

/** Largest explicit-RK4-stable step (s): dt * |lambda| <= 0.4 with lambda = max|dT/dw| / J. Capped at 1 ms. */
export function stableStep(tbl: TorqueTable, p: LabInputs): number {
  const lambda = (tbl.maxSlope + p.damping) / p.inertia;
  return Math.min(1e-3, 0.4 / Math.max(lambda, 1e-9));
}

/** One RK4 step. Never produces NaN: inputs are validated, speed is clamped to |w| <= w_s. */
export function stepSim(s: SimState, tbl: TorqueTable, p: LabInputs, dt: number): SimState {
  const wS = tbl.omegaS;
  let omega = 0;
  if (!p.rotorLocked) {
    const f = (w: number) => acceleration(tbl, p, s.auxOn, s.energized, w);
    const k1 = f(s.omega);
    const k2 = f(s.omega + 0.5 * dt * k1);
    const k3 = f(s.omega + 0.5 * dt * k2);
    const k4 = f(s.omega + dt * k3);
    omega = s.omega + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    omega = Math.min(wS, Math.max(-wS, omega));
    const crossed = s.omega !== 0 && Math.sign(omega) !== Math.sign(s.omega);
    const t0 = Math.abs(motorTorque(tbl, s.auxOn, s.energized, 0));
    if ((crossed || Math.abs(omega) < STICK_FRACTION * wS) && t0 <= p.loadTorque) omega = 0; // stops and stays stopped
  }
  const auxOn = nextAuxState(s.auxOn, omega, wS, p);
  return { t: s.t + dt, omega, auxOn, energized: s.energized, toggles: s.toggles + (auxOn !== s.auxOn ? 1 : 0) };
}

// ---------------------------------------------------------------- headless startup analysis

export interface Trajectory {
  t: number[];
  omega: number[];
  torque: number[]; // motor torque [N.m]
  auxOn: boolean[];
}
export type StartupOutcome = 'settles' | 'no-start' | 'stalls' | 'cycles' | 'slow';

export interface StartupAnalysis {
  outcome: StartupOutcome;
  finalOmega: number;
  finalSpeedRpm: number;
  finalSlip: number;
  maxAbsOmega: number;
  timeToSpeed: number | null; // s to reach 90 % of the final speed (only when the motor settles)
  timeToSettle: number | null;
  auxOnAtEnd: boolean;
  toggles: number;
  trajectory: Trajectory;
}

export interface AnalyzeOptions {
  omega0?: number;
  tMax?: number;
  table?: TorqueTable;
  motor?: MotorParams;
}

export function analyzeStartup(p: LabInputs, opts: AnalyzeOptions = {}): StartupAnalysis {
  const motor = opts.motor ?? EXAMPLE_MOTOR;
  const tbl = opts.table ?? buildTorqueTable(p, motor);
  const wS = tbl.omegaS;
  const dt = stableStep(tbl, p);
  const tMax = opts.tMax ?? 12;
  const omega0 = opts.omega0 ?? 0;
  let st = initialState(p, wS, omega0);
  const traj: Trajectory = { t: [], omega: [], torque: [], auxOn: [] };
  const record = () => {
    traj.t.push(st.t);
    traj.omega.push(st.omega);
    traj.torque.push(motorTorque(tbl, st.auxOn, st.energized, st.omega));
    traj.auxOn.push(st.auxOn);
  };
  let maxAbs = Math.abs(st.omega);
  let nextSample = 0;
  let lastCheck = 0;
  let omegaAtCheck = st.omega;
  let togglesAtCheck = 0;
  let settledAt: number | null = null;
  const steps = Math.ceil(tMax / dt);
  for (let i = 0; i < steps; i++) {
    if (st.t >= nextSample) {
      record();
      nextSample += 0.005;
    }
    st = stepSim(st, tbl, p, dt);
    maxAbs = Math.max(maxAbs, Math.abs(st.omega));
    if (st.t - lastCheck >= 0.3) {
      if (Math.abs(st.omega - omegaAtCheck) < 0.002 * wS && st.toggles === togglesAtCheck) {
        settledAt = st.t;
        break;
      }
      lastCheck = st.t;
      omegaAtCheck = st.omega;
      togglesAtCheck = st.toggles;
    }
  }
  record();

  const finalAbs = Math.abs(st.omega);
  let outcome: StartupOutcome;
  if (finalAbs < 0.05 * wS) outcome = maxAbs > 0.05 * wS ? 'stalls' : 'no-start'; // was turning, then stopped / never moved
  else if (settledAt !== null) outcome = 'settles';
  else if (st.toggles >= 4) outcome = 'cycles';
  else outcome = 'slow';

  let timeToSpeed: number | null = null;
  if (outcome === 'settles') {
    const target = 0.9 * finalAbs;
    for (let i = 1; i < traj.t.length; i++) {
      const a = Math.abs(traj.omega[i - 1]);
      const b = Math.abs(traj.omega[i]);
      if (b >= target) {
        const f = b === a ? 1 : (target - a) / (b - a);
        timeToSpeed = traj.t[i - 1] + Math.min(1, Math.max(0, f)) * (traj.t[i] - traj.t[i - 1]);
        break;
      }
    }
  }
  return {
    outcome,
    finalOmega: st.omega,
    finalSpeedRpm: radPerSecToRpm(st.omega),
    finalSlip: 1 - st.omega / wS,
    maxAbsOmega: maxAbs,
    timeToSpeed,
    timeToSettle: settledAt,
    auxOnAtEnd: st.auxOn,
    toggles: st.toggles,
    trajectory: traj,
  };
}

// ---------------------------------------------------------------- live operating point helpers

/** Exact phasor solution at the present speed and switch state (quasi-static: electrical transients are ignored). */
export function operatingPoint(p: LabInputs, motor: MotorParams, omega: number, auxOn: boolean): Solution {
  return solveAtSpeed(motor, electricalFor(p, motor, auxOn), omega);
}

export interface CurvePack {
  main: Solution[]; // main winding only
  aux: Solution[] | null; // with auxiliary branch
}
export function buildCurves(p: LabInputs, motor: MotorParams = EXAMPLE_MOTOR, n = 160): CurvePack {
  const sweep = (e: Electrical): Solution[] => {
    const out: Solution[] = [];
    for (let i = 0; i <= n; i++) out.push(solveAtSlip(motor, e, 2 - (2 * i) / n));
    return out;
  };
  return {
    main: sweep(electricalFor(p, motor, false)),
    aux: hasStartCircuit(p) ? sweep(electricalFor(p, motor, true)) : null,
  };
}

/** Two cycles of the main / auxiliary current waveforms for a phasor solution: i(t) = sqrt(2) |I| cos(wt + arg I). */
export function currentWaveforms(sol: Solution, frequencyHz: number, cycles = 2, n = 240) {
  const w = 2 * Math.PI * frequencyHz;
  const im = Math.hypot(sol.iMain.re, sol.iMain.im);
  const ia = Math.hypot(sol.iAux.re, sol.iAux.im);
  const pm = Math.atan2(sol.iMain.im, sol.iMain.re);
  const pa = Math.atan2(sol.iAux.im, sol.iAux.re);
  const out: { tMs: number; main: number; aux: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * (cycles / frequencyHz);
    out.push({ tMs: t * 1000, main: Math.SQRT2 * im * Math.cos(w * t + pm), aux: Math.SQRT2 * ia * Math.cos(w * t + pa) });
  }
  return out;
}
