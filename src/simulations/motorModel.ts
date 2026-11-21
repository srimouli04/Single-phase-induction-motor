// Physical model of a single-phase induction motor (double-revolving-field theory).
// Pure functions only: no React, no DOM. See README "Physics models" for the derivation.
import { type Complex, abs2, add, arg, c, div, isFiniteComplex, J, mul, scale, sub } from './complex.ts';

// ---------------------------------------------------------------- basic relations

/** Synchronous speed N_s = 120 f / P  [rpm]. Throws RangeError for invalid f or P. */
export function synchronousSpeedRpm(frequencyHz: number, poles: number): number {
  if (!Number.isFinite(frequencyHz) || frequencyHz <= 0) throw new RangeError('Frequency must be a positive number of Hz.');
  if (!isValidPoleCount(poles)) throw new RangeError('Pole count must be an even integer of at least 2.');
  return (120 * frequencyHz) / poles;
}

/** Per-unit slip s = (N_s - N_r) / N_s. Throws RangeError for invalid speeds. */
export function slipFromSpeeds(syncRpm: number, rotorRpm: number): number {
  if (!Number.isFinite(syncRpm) || syncRpm <= 0) throw new RangeError('Synchronous speed must be positive.');
  if (!Number.isFinite(rotorRpm)) throw new RangeError('Rotor speed must be a finite number.');
  return (syncRpm - rotorRpm) / syncRpm;
}

/** N_r = N_s (1 - s) [rpm]. */
export const rotorSpeedFromSlip = (syncRpm: number, slip: number): number => syncRpm * (1 - slip);
/** Forward-field slip s_f = s. */
export const forwardSlip = (slip: number): number => slip;
/** Backward-field slip s_b = 2 - s. */
export const backwardSlip = (slip: number): number => 2 - slip;
export const rpmToRadPerSec = (rpm: number): number => (rpm * 2 * Math.PI) / 60;
export const radPerSecToRpm = (w: number): number => (w * 60) / (2 * Math.PI);
export const isValidPoleCount = (p: number): boolean => Number.isInteger(p) && p >= 2 && p % 2 === 0;
/** Synchronous mechanical angular speed [rad/s] = 4 pi f / P. */
export const syncOmega = (frequencyHz: number, poles: number): number => (4 * Math.PI * frequencyHz) / poles;

// ---------------------------------------------------------------- example motor

/**
 * Equivalent-circuit parameters, referred to the MAIN winding.
 * Reactances are given at `refFrequencyHz` and scaled linearly with frequency (constant inductance).
 * ILLUSTRATIVE values of the same order as a small (~1/4 hp, 120 V, 60 Hz) motor. NOT a datasheet.
 */
export interface MotorParams {
  refFrequencyHz: number;
  r1m: number; // main-winding stator resistance [ohm]
  x1m: number; // main-winding stator leakage reactance [ohm]
  xm: number; // magnetising reactance of the main winding (full value) [ohm]
  r2: number; // rotor resistance referred to main winding [ohm]
  x2: number; // rotor leakage reactance referred to main winding [ohm]
  r1a: number; // auxiliary-winding resistance, own turns [ohm]
  x1a: number; // auxiliary-winding leakage reactance, own turns [ohm]
  turnsRatio: number; // a = N_aux / N_main (effective turns)
}

export const EXAMPLE_MOTOR: MotorParams = {
  refFrequencyHz: 60,
  r1m: 2.5,
  x1m: 4.1,
  xm: 72,
  r2: 3.5,
  x2: 2.2,
  r1a: 11.8,
  x1a: 3.6,
  turnsRatio: 1.15,
};

// ---------------------------------------------------------------- user-controlled inputs

export type StartMethod = 'main-only' | 'split-phase' | 'capacitor-start' | 'psc';
export type SwitchFault = 'none' | 'stuck-open' | 'stuck-closed';

export const START_METHODS: { id: StartMethod; label: string }[] = [
  { id: 'main-only', label: 'Main winding only' },
  { id: 'split-phase', label: 'Split-phase (resistance start)' },
  { id: 'capacitor-start', label: 'Capacitor-start' },
  { id: 'psc', label: 'Permanent split capacitor (PSC)' },
];

export interface LabInputs {
  frequencyHz: number;
  poles: number;
  voltage: number; // V rms
  loadTorque: number; // N.m, constant-torque load opposing rotation
  inertia: number; // kg.m^2 (rotor + load, referred to the motor shaft)
  damping: number; // N.m.s/rad, viscous friction coefficient
  method: StartMethod;
  capacitanceUF: number; // start / run capacitor [uF] (capacitor-start, PSC)
  auxResistance: number; // total series resistance of the auxiliary branch [ohm] (split-phase)
  cutoutFraction: number; // centrifugal switch opens at this fraction of synchronous speed
  auxReversed: boolean; // auxiliary-winding leads swapped relative to the main winding (reverses direction)
  auxOpen: boolean; // fault: auxiliary branch open-circuit
  switchFault: SwitchFault; // fault: centrifugal switch stuck
  rotorLocked: boolean; // fault: rotor obstructed (speed forced to zero)
}

export const DEFAULT_INPUTS: LabInputs = {
  frequencyHz: 60,
  poles: 4,
  voltage: 120,
  loadTorque: 0.8,
  inertia: 0.005,
  damping: 0.0003,
  method: 'capacitor-start',
  capacitanceUF: 150,
  auxResistance: 9,
  cutoutFraction: 0.75,
  auxReversed: false,
  auxOpen: false,
  switchFault: 'none',
  rotorLocked: false,
};

export interface Range {
  min: number;
  max: number;
  step: number;
}
export const LIMITS = {
  frequencyHz: { min: 40, max: 70, step: 1 },
  voltage: { min: 60, max: 140, step: 1 },
  loadTorque: { min: 0, max: 3.5, step: 0.05 },
  inertia: { min: 0.001, max: 0.05, step: 0.001 },
  damping: { min: 0, max: 0.003, step: 0.0001 },
  capacitanceUF: { min: 5, max: 400, step: 5 },
  auxResistance: { min: 3, max: 25, step: 0.5 },
  cutoutFraction: { min: 0.5, max: 0.9, step: 0.01 },
} satisfies Record<string, Range>;
export const POLE_OPTIONS = [2, 4, 6, 8];
/** Hysteresis of the centrifugal switch: it re-closes this fraction of N_s below its opening speed. */
export const SWITCH_HYSTERESIS = 0.1;

/** Sensible capacitor / resistor defaults when the student changes the starting method. */
export function methodDefaults(method: StartMethod): Partial<LabInputs> {
  if (method === 'psc') return { method, capacitanceUF: 25 };
  if (method === 'capacitor-start') return { method, capacitanceUF: 150 };
  if (method === 'split-phase') return { method, auxResistance: 9 };
  return { method };
}

export type RawInputs = Partial<Record<keyof LabInputs, unknown>>;

/** Clamp / repair user input. Never throws; reports what was changed in `issues`. */
export function validateInputs(raw: RawInputs): { inputs: LabInputs; issues: string[] } {
  const issues: string[] = [];
  const out: LabInputs = { ...DEFAULT_INPUTS };

  const numeric = (key: keyof typeof LIMITS, label: string, unit: string) => {
    const v = raw[key];
    if (v === undefined) return;
    const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
    const { min, max } = LIMITS[key];
    if (!Number.isFinite(n)) {
      issues.push(`${label}: "${String(v)}" is not a valid number; using ${DEFAULT_INPUTS[key]} ${unit}.`);
      return;
    }
    const clamped = Math.min(max, Math.max(min, n));
    if (clamped !== n) issues.push(`${label}: ${n} ${unit} is outside ${min}-${max} ${unit}; clamped to ${clamped}.`);
    out[key] = clamped;
  };
  numeric('frequencyHz', 'Frequency', 'Hz');
  numeric('voltage', 'Voltage', 'V');
  numeric('loadTorque', 'Load torque', 'N·m');
  numeric('inertia', 'Inertia', 'kg·m²');
  numeric('damping', 'Damping', 'N·m·s/rad');
  numeric('capacitanceUF', 'Capacitance', 'µF');
  numeric('auxResistance', 'Auxiliary resistance', 'Ω');
  numeric('cutoutFraction', 'Switch cut-out speed', '×Ns');

  if (raw.poles !== undefined) {
    const p = Number(raw.poles);
    if (!Number.isFinite(p)) {
      issues.push(`Poles: "${String(raw.poles)}" is not a number; using ${DEFAULT_INPUTS.poles}.`);
    } else {
      const nearest = POLE_OPTIONS.reduce((best, o) => (Math.abs(o - p) < Math.abs(best - p) ? o : best), POLE_OPTIONS[0]);
      if (nearest !== p) issues.push(`Poles: ${p} is not a supported even pole count; using ${nearest}.`);
      out.poles = nearest;
    }
  }
  if (raw.method !== undefined) {
    if (START_METHODS.some((m) => m.id === raw.method)) out.method = raw.method as StartMethod;
    else issues.push(`Unknown starting method "${String(raw.method)}"; using ${DEFAULT_INPUTS.method}.`);
  }
  if (raw.switchFault !== undefined) {
    if (raw.switchFault === 'none' || raw.switchFault === 'stuck-open' || raw.switchFault === 'stuck-closed') out.switchFault = raw.switchFault;
    else issues.push('Unknown switch fault; using none.');
  }
  if (typeof raw.auxReversed === 'boolean') out.auxReversed = raw.auxReversed;
  if (typeof raw.auxOpen === 'boolean') out.auxOpen = raw.auxOpen;
  if (typeof raw.rotorLocked === 'boolean') out.rotorLocked = raw.rotorLocked;
  return { inputs: out, issues };
}

// ---------------------------------------------------------------- electrical solution

export interface AuxBranch {
  resistance: number; // total series resistance of the auxiliary branch [ohm]
  capacitanceUF: number; // 0 = no capacitor
}
export interface Electrical {
  voltage: number;
  frequencyHz: number;
  poles: number;
  aux: AuxBranch | null; // null = auxiliary branch disconnected
  auxReversed?: boolean; // swap the auxiliary-winding leads (turns ratio sign flips)
}

/** Does the selected configuration contain an (intact) auxiliary winding branch? */
export function hasStartCircuit(inputs: LabInputs): boolean {
  return inputs.method !== 'main-only' && !inputs.auxOpen;
}

/** Build the electrical description. `withAux=false` gives the main-winding-only network. */
export function electricalFor(inputs: LabInputs, motor: MotorParams, withAux: boolean): Electrical {
  const base = { voltage: inputs.voltage, frequencyHz: inputs.frequencyHz, poles: inputs.poles, auxReversed: inputs.auxReversed };
  if (!withAux || !hasStartCircuit(inputs)) return { ...base, aux: null };
  if (inputs.method === 'split-phase') return { ...base, aux: { resistance: inputs.auxResistance, capacitanceUF: 0 } };
  return { ...base, aux: { resistance: motor.r1a, capacitanceUF: inputs.capacitanceUF } };
}

export interface Solution {
  slip: number;
  omegaS: number; // synchronous mechanical speed [rad/s]
  zF: Complex; // forward rotor-side impedance (full, un-halved) [ohm]
  zB: Complex;
  iF: Complex; // forward / backward sequence currents (A rms, main-winding-equivalent)
  iB: Complex;
  iMain: Complex; // main-winding current phasor (A rms, voltage phasor at 0 deg)
  iAux: Complex; // auxiliary-winding current phasor (A rms)
  iLine: Complex;
  torqueF: number; // N.m developed by the forward field (>= 0 for 0 < s < 2)
  torqueB: number; // N.m magnitude developed by the backward field (acts against forward rotation)
  torqueNet: number; // torqueF - torqueB
  inputPower: number; // W
  statorCopperLoss: number; // W
  rotorCopperLoss: number; // W
  mechanicalPower: number; // W (air-gap power converted, before friction / windage / core loss)
  powerFactor: number; // line power factor (lagging if iLine lags V)
  auxLeadDeg: number; // time-phase angle by which I_aux leads I_main [deg] (0 when no aux branch)
}

/** Rotor branch in parallel with the magnetising branch, written with admittances so s = 0 is safe. */
function rotorImpedance(r2: number, x2: number, xm: number, s: number): Complex {
  // y_rotor = s / (R2 + j s X2);  y_mag = 1 / (j Xm) = -j / Xm
  const d = r2 * r2 + s * s * x2 * x2;
  const y = c((s * r2) / d, -(s * s * x2) / d - 1 / xm);
  return div(c(1), y);
}

/**
 * Exact (within the model) solution at slip s, 0 <= s <= 2 (s = 1 - N_r / N_s; s > 1 means reverse rotation).
 * Two-winding network solved with symmetrical components; with `aux = null` it reduces to the classic
 * single-phase equivalent circuit with the 0.5 Z_F + 0.5 Z_B split.
 */
export function solveAtSlip(motor: MotorParams, e: Electrical, s: number): Solution {
  const k = e.frequencyHz / motor.refFrequencyHz;
  const x1m = motor.x1m * k;
  const xm = motor.xm * k;
  const x2 = motor.x2 * k;
  const omegaS = syncOmega(e.frequencyHz, e.poles);
  const zF = rotorImpedance(motor.r2, x2, xm, s);
  const zB = rotorImpedance(motor.r2, x2, xm, 2 - s);
  const z1m = c(motor.r1m, x1m);
  const V = c(e.voltage, 0);

  let iF: Complex;
  let iB: Complex;
  let iMain: Complex;
  let iAux = c(0);
  let rAux = 0;

  if (!e.aux) {
    iMain = div(V, add(z1m, scale(add(zF, zB), 0.5)));
    iF = scale(iMain, 0.5);
    iB = scale(iMain, 0.5);
  } else {
    const a = e.auxReversed ? -motor.turnsRatio : motor.turnsRatio;
    const w = 2 * Math.PI * e.frequencyHz;
    const xc = e.aux.capacitanceUF > 0 ? 1e6 / (w * e.aux.capacitanceUF) : 0;
    rAux = e.aux.resistance;
    const zAux = c(rAux, motor.x1a * k - xc);
    const zaR = scale(zAux, 1 / (a * a)); // referred to the main-winding turns
    const vaR = c(e.voltage / a, 0);
    const vF = scale(sub(V, mul(J, vaR)), 0.5); // (V_m - j V_a') / 2
    const vB = scale(add(V, mul(J, vaR)), 0.5); // (V_m + j V_a') / 2
    const zs = scale(add(z1m, zaR), 0.5);
    const zd = scale(sub(z1m, zaR), 0.5);
    const a11 = add(zs, zF);
    const a22 = add(zs, zB);
    const det = sub(mul(a11, a22), mul(zd, zd));
    iF = div(sub(mul(a22, vF), mul(zd, vB)), det);
    iB = div(sub(mul(a11, vB), mul(zd, vF)), det);
    iMain = add(iF, iB);
    iAux = scale(mul(J, sub(iF, iB)), 1 / a); // I_a' = j (I_f - I_b), I_a = I_a' / a
  }

  const pF = 2 * zF.re * abs2(iF); // air-gap power, forward field [W]
  const pB = 2 * zB.re * abs2(iB);
  const torqueF = pF / omegaS;
  const torqueB = pB / omegaS;
  const iLine = add(iMain, iAux);
  const inputPower = e.voltage * iLine.re;
  const statorCopperLoss = abs2(iMain) * motor.r1m + abs2(iAux) * rAux;
  const rotorCopperLoss = s * pF + (2 - s) * pB;
  const mechanicalPower = (1 - s) * (pF - pB);
  const apparent = e.voltage * Math.sqrt(abs2(iLine));
  const out: Solution = {
    slip: s,
    omegaS,
    zF,
    zB,
    iF,
    iB,
    iMain,
    iAux,
    iLine,
    torqueF,
    torqueB,
    torqueNet: torqueF - torqueB,
    inputPower,
    statorCopperLoss,
    rotorCopperLoss,
    mechanicalPower,
    powerFactor: apparent > 0 ? inputPower / apparent : 1,
    auxLeadDeg: e.aux ? wrapDeg(((arg(iAux) - arg(iMain)) * 180) / Math.PI) : 0,
  };
  if (![out.torqueF, out.torqueB, out.inputPower].every(Number.isFinite) || !isFiniteComplex(iLine)) {
    throw new RangeError('Model produced a non-finite value; parameters are outside the supported range.');
  }
  return out;
}

const wrapDeg = (d: number): number => ((((d + 180) % 360) + 360) % 360) - 180;

/** Solve at a mechanical speed in rad/s, |omega| <= omegaS. */
export function solveAtSpeed(motor: MotorParams, e: Electrical, omega: number): Solution {
  const wS = syncOmega(e.frequencyHz, e.poles);
  const w = Math.min(wS, Math.max(-wS, omega));
  return solveAtSlip(motor, e, 1 - w / wS);
}

/** Torque / current sweep over s in [0, 2], i.e. speed from +N_s down to -N_s. Returned in increasing speed order. */
export function sweepSpeed(motor: MotorParams, e: Electrical, n = 200): Solution[] {
  const out: Solution[] = [];
  for (let i = 0; i <= n; i++) out.push(solveAtSlip(motor, e, 2 - (2 * i) / n));
  return out;
}

/** Largest forward net torque over 0 < s < 1 and the speed [rpm] where it occurs ("breakdown torque"). */
export function breakdownTorque(motor: MotorParams, e: Electrical): { torque: number; speedRpm: number } {
  const ns = synchronousSpeedRpm(e.frequencyHz, e.poles);
  let best = { torque: -Infinity, speedRpm: 0 };
  const n = 400;
  for (let i = 0; i <= n; i++) {
    const s = 1 - i / n; // 1 -> 0
    const t = solveAtSlip(motor, e, s).torqueNet;
    if (t > best.torque) best = { torque: t, speedRpm: ns * (1 - s) };
  }
  return best;
}
