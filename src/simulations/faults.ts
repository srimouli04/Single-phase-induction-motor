// Fault scenarios: how a fault changes the electrical model, how much extra heat it makes, and how fast that heat
// damages the motor. Illustrative first-order models with stated assumptions; trends, not predictions.
import { abs2 } from './complex.ts';
import { summarize, type LabSummary } from './metrics.ts';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, LIMITS, validateInputs, type LabInputs, type MotorParams } from './motorModel.ts';

export type FaultId =
  | 'cap-open'
  | 'cap-weak'
  | 'aux-open'
  | 'switch-open'
  | 'switch-closed'
  | 'main-open'
  | 'turn-short'
  | 'core-short'
  | 'ground-fault'
  | 'broken-bars'
  | 'bearing-wear'
  | 'locked-rotor'
  | 'low-voltage'
  | 'overload'
  | 'blocked-cooling';

export const FAULT_IDS: FaultId[] = [
  'cap-open',
  'cap-weak',
  'aux-open',
  'switch-open',
  'switch-closed',
  'main-open',
  'turn-short',
  'core-short',
  'ground-fault',
  'broken-bars',
  'bearing-wear',
  'locked-rotor',
  'low-voltage',
  'overload',
  'blocked-cooling',
];

/** Healthy reference motor for the fault simulator: the default capacitor-start motor at 120 V and 0.8 N.m. */
export const BASELINE: LabInputs = DEFAULT_INPUTS;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

// ---------------------------------------------------------------- protection devices

export const BREAKER_RATING_A = 15;

/**
 * Time for a 15 A thermal-magnetic breaker to open at a given current [s]; null = never.
 * Illustrative curve: instantaneous at 5x rating, inverse-time below, no trip at or below 105 %.
 */
export function breakerTripTime(currentA: number, ratingA = BREAKER_RATING_A): number | null {
  if (!Number.isFinite(currentA) || currentA <= 0) return null;
  const x = currentA / ratingA;
  if (x >= 5) return 0.02;
  if (x <= 1.05) return null;
  return Math.min(7200, 90 / (x * x - 1));
}

/** Residual-current device threshold [A]. */
export const RCD_TRIP_A = 0.03;

// ---------------------------------------------------------------- closed-form fault formulas

/** Shorted-turn fault resistance used in the simulator (contact resistance of the insulation breakdown) [ohm]. */
export const TURN_SHORT_CONTACT_OHM = 0.02;

export interface TurnShort {
  /** Circulating current in the bypassed turns [A rms]. */
  loopCurrentA: number;
  /** Heat produced in the shorted loop [W]. */
  powerW: number;
  /** Extra supply current seen by the line, in phase with the voltage [A]: power balance, P / V. */
  extraLineCurrentA: number;
  /** Fraction of the supply voltage that still reaches the magnetic circuit after the extra drop in the winding. */
  voltageFactor: number;
}

/**
 * Inter-turn short: a fraction k of the main-winding turns is bypassed. The bypassed turns form a closed loop linked by the
 * same flux (a shorted transformer secondary). With the flux set by the supply, the loop sees emf = k V and has resistance
 * k r1 + R_f and reactance k^2 x1, so I_loop = k V / |Z_loop| and P = I_loop^2 (k r1 + R_f).
 * Assumes coupling ~ 1, E ~ V and that the extra supply current flows through the remaining winding resistance.
 */
export function turnShort(k: number, contactOhm: number, volts: number, frequencyHz: number, motor: MotorParams): TurnShort {
  const kk = Math.min(0.5, Math.max(1e-4, k));
  const rLoop = kk * motor.r1m + contactOhm;
  const xLoop = kk * kk * motor.x1m * (frequencyHz / motor.refFrequencyHz);
  const loopCurrentA = (kk * volts) / Math.hypot(rLoop, xLoop);
  const powerW = loopCurrentA * loopCurrentA * rLoop;
  const extraLineCurrentA = powerW / volts;
  const voltageFactor = Math.max(0.5, 1 - (extraLineCurrentA * (1 - kk) * motor.r1m) / volts);
  return { loopCurrentA, powerW, extraLineCurrentA, voltageFactor };
}

/** Eddy-current loss multiplier for a block of bridged laminations (loss ~ thickness^2, capped by skin effect). */
export const CORE_SHORT_MULTIPLIER = 20;

/** Extra iron loss when a fraction of the stator core volume has its laminations bridged [W]. */
export const coreShortLoss = (fraction: number, baseCoreLossW: number): number => baseCoreLossW * clamp01(fraction) * CORE_SHORT_MULTIPLIER;

/** Ground-fault current from a winding to the earthed stator core / frame [A rms]. */
export const groundFaultCurrent = (volts: number, faultOhm: number, windingOhm: number): number => volts / (faultOhm + windingOhm);

/** Insulation life at its rated temperature (class B, 130 C) [h]: the usual 20 000 h design figure. */
export const RATED_LIFE_H = 20000;
/**
 * Insulation life at a steady temperature [h]: halves for every 10 K above the rating (the "10-degree rule", Montsinger / Arrhenius
 * approximation). A rule of thumb for slow thermal ageing only: it says nothing about arcing or sudden breakdown.
 */
export const insulationLifeHours = (tempC: number, ratedC = 130): number => RATED_LIFE_H * 2 ** ((ratedC - tempC) / 10);

// ---------------------------------------------------------------- lumped thermal model

export interface ThermalParams {
  ambientC: number;
  /** Heat capacity of the winding copper and varnish [J/K]. */
  cWinding: number;
  /** Heat capacity of the stator core, rotor and frame [J/K]. */
  cCore: number;
  /** Thermal resistance winding to core [K/W]. */
  rWindingCore: number;
  /** Thermal resistance core / frame to ambient air with the fan working [K/W]. */
  rCoreAmbient: number;
  /** Resistance between a hot spot that is a fraction f of its host and the host: R_ref f^(-1/3) [K/W] (conduction out of a small volume). */
  rHotWinding: number;
  rHotCore: number;
  /** Built-in thermal protector (senses the winding temperature) opens / resets here [C]. */
  tripC: number;
  resetC: number;
  /** Insulation rating (class B) [C]. */
  limitC: number;
  /** Temperature at which varnish chars and insulation is destroyed [C]; the model stops there. */
  failC: number;
  /** Iron loss at 120 V [W]. */
  baseCoreLossW: number;
}

export const THERMAL: ThermalParams = {
  ambientC: 40,
  cWinding: 320,
  cCore: 1900,
  rWindingCore: 0.12,
  rCoreAmbient: 0.55,
  rHotWinding: 0.12,
  rHotCore: 0.15,
  tripC: 120,
  resetC: 85,
  limitC: 130,
  failC: 200,
  baseCoreLossW: 22,
};

export interface HotSpot {
  powerW: number;
  /** Which node holds the hot spot. */
  host: 'winding' | 'core';
  /** Share of the host's heat capacity that the hot spot occupies (0..1). */
  fraction: number;
  label: string;
  /** Rating and destruction temperature of this particular spot [C]; default to the insulation values. */
  limitC?: number;
  failC?: number;
  /** Thermal resistance to the host [K/W]; default R_ref f^(-1/3) (conduction out of a small volume). */
  resistance?: number;
  /** Bearings are limited by grease and seizure, not by winding insulation. */
  kind?: 'insulation' | 'bearing';
}
export interface HeatSources {
  /** Heat in the winding node [W]. */
  windingW: number;
  /** Heat in the core / rotor / frame node [W]. */
  coreW: number;
  hot: HotSpot | null;
  /** Multiplies the core-to-ambient thermal resistance (blocked cooling > 1). */
  coolingFactor: number;
}

export interface ThermalResult {
  t: number[];
  winding: number[];
  core: number[];
  /** Hot-spot temperature (equals the winding temperature when there is no hot spot). */
  hot: number[];
  hotLabel: string | null;
  /** Rating and destruction temperature of the hot spot (or of the winding when there is none) [C]. */
  hotLimitC: number;
  hotFailC: number;
  /** First time the protector opened; how many times it opened in total. */
  firstTripS: number | null;
  tripCount: number;
  /** First time the winding or a hot spot reaches its rating. */
  firstLimitS: number | null;
  /** Time at which something is destroyed (the run stops there), and what. */
  failureS: number | null;
  failureLabel: string | null;
  peakWindingC: number;
  peakHotC: number;
  /** Fraction of the time the motor was energised (not held off by the protector). */
  dutyFraction: number;
}

const hotFraction = (h: HotSpot): number => Math.min(1, Math.max(0.005, h.fraction));
function hotResistance(h: HotSpot, p: ThermalParams): number {
  return h.resistance ?? (h.host === 'winding' ? p.rHotWinding : p.rHotCore) * hotFraction(h) ** (-1 / 3);
}
const hotCapacity = (h: HotSpot, p: ThermalParams): number => hotFraction(h) * (h.host === 'winding' ? p.cWinding : p.cCore);

/** Closed-form steady state with no protector and no failure: the oracle the simulation is tested against. */
export function steadyTemps(src: HeatSources, p: ThermalParams = THERMAL): { winding: number; core: number; hot: number } {
  const ph = src.hot?.powerW ?? 0;
  const hostW = src.hot?.host === 'winding';
  const core = p.ambientC + (src.windingW + src.coreW + ph) * p.rCoreAmbient * src.coolingFactor;
  const winding = core + (src.windingW + (hostW ? ph : 0)) * p.rWindingCore;
  const hot = src.hot ? (hostW ? winding : core) + ph * hotResistance(src.hot, p) : winding;
  return { winding, core, hot };
}

export interface ThermalOptions {
  params?: ThermalParams;
  /** Disable the thermal protector and the destruction limit (closed-form checks). */
  open?: boolean;
  /** Output samples. */
  samples?: number;
}

/**
 * Explicit-Euler integration of the three-node network (winding, hot spot, core) with a thermal protector (hysteresis) and a
 * destruction limit: the run stops where the model stops being valid (insulation destroyed).
 */
export function simulateThermal(src: HeatSources, tEnd: number, opts: ThermalOptions = {}): ThermalResult {
  const p = opts.params ?? THERMAL;
  const hot = src.hot;
  const hostW = hot?.host === 'winding';
  const rHot = hot ? hotResistance(hot, p) : 1;
  const cHot = hot ? hotCapacity(hot, p) : 1;
  const rCool = p.rCoreAmbient * src.coolingFactor;
  const limitHot = hot?.limitC ?? p.limitC;
  const failHot = hot?.failC ?? p.failC;
  // The step stays well below the fastest time constant and resolves a violent hot spot (>= ~20 steps before it fails).
  const riseS = hot ? ((p.failC - p.ambientC) * cHot) / Math.max(1, hot.powerW) : Infinity;
  const dt = Math.max(0.01, Math.min(0.25, hot ? 0.2 * rHot * cHot : 0.25, riseS / 20));
  const steps = Math.max(1, Math.ceil(tEnd / dt));
  const every = Math.max(1, Math.floor(steps / (opts.samples ?? 500)));

  let tw = p.ambientC;
  let tc = p.ambientC;
  let th = p.ambientC;
  let tripped = false;
  let onSteps = 0;
  const out: ThermalResult = {
    t: [],
    winding: [],
    core: [],
    hot: [],
    hotLabel: hot ? hot.label : null,
    hotLimitC: limitHot,
    hotFailC: failHot,
    firstTripS: null,
    tripCount: 0,
    firstLimitS: null,
    failureS: null,
    failureLabel: null,
    peakWindingC: tw,
    peakHotC: th,
    dutyFraction: 1,
  };
  const sample = (time: number): void => {
    out.t.push(time);
    out.winding.push(tw);
    out.core.push(tc);
    out.hot.push(hot ? th : tw);
  };

  let i = 0;
  for (; i <= steps; i++) {
    const time = i * dt;
    if (!opts.open) {
      if (tw >= p.failC) {
        out.failureS = time;
        out.failureLabel = 'Winding insulation';
      } else if (hot && th >= failHot) {
        out.failureS = time;
        out.failureLabel = hot.label;
      }
      if (out.failureS !== null) break;
      if (!tripped && tw >= p.tripC) {
        tripped = true;
        out.tripCount++;
        out.firstTripS ??= time;
      } else if (tripped && tw <= p.resetC) tripped = false;
    }
    if (i % every === 0) sample(time);
    if (out.firstLimitS === null && (tw >= p.limitC || (hot && th >= limitHot))) out.firstLimitS = time;
    if (!tripped) onSteps++;

    const k = tripped ? 0 : 1;
    const flowHot = hot ? (th - (hostW ? tw : tc)) / rHot : 0; // hot spot -> host [W]
    const dTw = (src.windingW * k + (hostW ? flowHot : 0) - (tw - tc) / p.rWindingCore) / p.cWinding;
    const dTc = (src.coreW * k + (hot && !hostW ? flowHot : 0) + (tw - tc) / p.rWindingCore - (tc - p.ambientC) / rCool) / p.cCore;
    const dTh = hot ? (hot.powerW * k - flowHot) / cHot : 0;
    tw += dTw * dt;
    tc += dTc * dt;
    th = hot ? th + dTh * dt : tw;
    out.peakWindingC = Math.max(out.peakWindingC, tw);
    out.peakHotC = Math.max(out.peakHotC, th, tw);
  }
  const end = Math.min(i, steps) * dt;
  if (out.t[out.t.length - 1] !== end) sample(end);
  out.dutyFraction = onSteps / Math.max(1, Math.min(i, steps));
  return out;
}

// ---------------------------------------------------------------- applying a fault

export interface FaultExtras {
  /** Real (in-phase) supply current on top of the circuit model [A]. */
  extraLineCurrentA: number;
  hot: HotSpot | null;
  groundCurrentA: number | null;
  groundFaultOhm: number | null;
  /** Free-text scenario facts for the report (e.g. "3 of 20 bars broken"). */
  facts: string[];
}
const NO_EXTRAS: FaultExtras = { extraLineCurrentA: 0, hot: null, groundCurrentA: null, groundFaultOhm: null, facts: [] };

export interface FaultEffect {
  inputs: LabInputs;
  motor: MotorParams;
  coolingFactor: number;
  /** Derive effects that depend on the simulated electrical state. */
  post: (s: LabSummary) => FaultExtras;
}

/** Resistance used to represent an open main winding [ohm]. */
export const OPEN_CIRCUIT_OHM = 1e4;

/** Default severity (0..1) for scenarios that have a slider. */
export const DEFAULT_SEVERITY: Partial<Record<FaultId, number>> = {
  'cap-weak': 0.6,
  'turn-short': 0.3,
  'core-short': 0.6,
  'ground-fault': 0.75,
  'broken-bars': 0.5,
  'bearing-wear': 0.5,
  'low-voltage': 0.5,
  overload: 0.5,
  'blocked-cooling': 0.6,
};
export const hasSeverity = (id: FaultId | 'none'): boolean => id !== 'none' && DEFAULT_SEVERITY[id] !== undefined;

export const shortedTurnFraction = (s: number): number => 0.02 + 0.23 * clamp01(s);
export const bridgedCoreFraction = (s: number): number => 0.02 + 0.28 * clamp01(s);
export const groundFaultOhms = (s: number): number => 10 ** (5 - 5.3 * clamp01(s));
export const brokenBars = (s: number): number => Math.round(1 + 5 * clamp01(s));
export const ROTOR_BARS = 20;
export const bearingFrictionNm = (s: number): number => 0.02 + 0.5 * clamp01(s);

const fmtOhm = (r: number): string => (r >= 1000 ? `${(r / 1000).toFixed(r >= 10000 ? 0 : 1)} kΩ` : `${r.toFixed(r >= 10 ? 0 : 1)} Ω`);

/** Human-readable severity, e.g. "9 % of the main-winding turns bypassed". */
export function describeSeverity(id: FaultId | 'none', severity: number, base: LabInputs = BASELINE): string {
  const s = clamp01(severity);
  switch (id) {
    case 'cap-weak':
      return `${(100 * (1 - 0.9 * s)).toFixed(0)} % of the capacitance left (${(base.capacitanceUF * (1 - 0.9 * s)).toFixed(0)} µF)`;
    case 'turn-short':
      return `${(100 * shortedTurnFraction(s)).toFixed(0)} % of the main-winding turns bypassed`;
    case 'core-short':
      return `${(100 * bridgedCoreFraction(s)).toFixed(0)} % of the core length bridged`;
    case 'ground-fault':
      return `fault resistance ${fmtOhm(groundFaultOhms(s))}`;
    case 'broken-bars':
      return `${brokenBars(s)} of ${ROTOR_BARS} rotor bars broken`;
    case 'bearing-wear':
      return `${bearingFrictionNm(s).toFixed(2)} N·m of extra bearing friction`;
    case 'low-voltage':
      return `${(100 * (1 - 0.35 * s)).toFixed(0)} % of the normal voltage`;
    case 'overload':
      return `${(100 * (1 + 2.2 * s)).toFixed(0)} % of the normal load`;
    case 'blocked-cooling':
      return `cooling only ${(100 / (1 + 2.5 * s)).toFixed(0)} % as effective`;
    default:
      return '';
  }
}

export function applyFault(id: FaultId | 'none', severity: number, base: LabInputs = BASELINE, motor: MotorParams = EXAMPLE_MOTOR): FaultEffect {
  const s = clamp01(severity);
  const inputs: LabInputs = { ...base };
  let m: MotorParams = { ...motor };
  let coolingFactor = 1;
  let post: (sum: LabSummary) => FaultExtras = () => NO_EXTRAS;

  switch (id) {
    case 'none':
      break;
    case 'cap-open':
    case 'aux-open':
      inputs.auxOpen = true;
      break;
    case 'cap-weak':
      inputs.capacitanceUF = Math.max(LIMITS.capacitanceUF.min, base.capacitanceUF * (1 - 0.9 * s));
      break;
    case 'switch-open':
      inputs.switchFault = 'stuck-open';
      break;
    case 'switch-closed':
      inputs.switchFault = 'stuck-closed';
      break;
    case 'main-open':
      m = { ...m, r1m: OPEN_CIRCUIT_OHM };
      break;
    case 'turn-short': {
      const k = shortedTurnFraction(s);
      const ts = turnShort(k, TURN_SHORT_CONTACT_OHM, base.voltage, base.frequencyHz, motor);
      inputs.voltage = base.voltage * ts.voltageFactor;
      post = () => ({
        extraLineCurrentA: ts.extraLineCurrentA,
        hot: { powerW: ts.powerW, host: 'winding', fraction: k, label: 'Shorted turns' },
        groundCurrentA: null,
        groundFaultOhm: null,
        facts: [`Circulating current in the shorted turns: ${ts.loopCurrentA.toFixed(0)} A`, `Heat in those turns: ${ts.powerW.toFixed(0)} W`, `Extra supply current: ${ts.extraLineCurrentA.toFixed(1)} A`],
      });
      break;
    }
    case 'core-short': {
      const f = bridgedCoreFraction(s);
      const extra = coreShortLoss(f, THERMAL.baseCoreLossW);
      post = (sum) => ({
        extraLineCurrentA: extra / sum.inputs.voltage,
        hot: { powerW: extra, host: 'core', fraction: f, label: 'Core hot spot' },
        groundCurrentA: null,
        groundFaultOhm: null,
        facts: [`Extra iron loss in the bridged region: ${extra.toFixed(0)} W (normal iron loss ${THERMAL.baseCoreLossW} W)`],
      });
      break;
    }
    case 'ground-fault': {
      const rf = groundFaultOhms(s);
      const rw = 0.2 * motor.r1m;
      const ig = groundFaultCurrent(base.voltage, rf, rw);
      post = () => ({
        extraLineCurrentA: ig, // the leakage path is fed from the line, so the supply carries it too
        hot: { powerW: ig * ig * rf, host: 'winding', fraction: 0.03, label: 'Fault spot' },
        groundCurrentA: ig,
        groundFaultOhm: rf,
        facts: [`Fault current to the frame: ${ig < 1 ? `${(ig * 1000).toFixed(0)} mA` : `${ig.toFixed(1)} A`}`, `Power dissipated at the fault: ${(ig * ig * rf).toFixed(0)} W`],
      });
      break;
    }
    case 'broken-bars': {
      const n = brokenBars(s);
      m = { ...m, r2: motor.r2 / (1 - n / ROTOR_BARS) };
      post = () => ({ ...NO_EXTRAS, facts: [`${n} of ${ROTOR_BARS} bars broken: rotor resistance up by ${((1 / (1 - n / ROTOR_BARS) - 1) * 100).toFixed(0)} %`] });
      break;
    }
    case 'bearing-wear': {
      const tf = bearingFrictionNm(s);
      inputs.loadTorque = Math.min(LIMITS.loadTorque.max, base.loadTorque + tf);
      post = (sum) => {
        const heatW = tf * Math.abs(sum.startup.finalOmega);
        return {
          ...NO_EXTRAS,
          hot: { powerW: heatW, host: 'core', fraction: 0.05, resistance: 0.6, label: 'Bearing', limitC: 110, failC: 150, kind: 'bearing' },
          facts: [`Friction heat generated in the bearing: ${heatW.toFixed(0)} W`],
        };
      };
      break;
    }
    case 'locked-rotor':
      inputs.rotorLocked = true;
      break;
    case 'low-voltage':
      inputs.voltage = base.voltage * (1 - 0.35 * s);
      break;
    case 'overload':
      inputs.loadTorque = Math.min(LIMITS.loadTorque.max, base.loadTorque * (1 + 2.2 * s));
      break;
    case 'blocked-cooling':
      coolingFactor = 1 + 2.5 * s;
      break;
  }
  return { inputs: validateInputs(inputs).inputs, motor: m, coolingFactor, post };
}

// ---------------------------------------------------------------- full run

export interface FaultReport {
  id: FaultId | 'none';
  severity: number;
  severityText: string;
  summary: LabSummary;
  extras: FaultExtras;
  heat: HeatSources;
  thermal: ThermalResult;
  /** Total supply current in the final state, including fault extras [A rms]. */
  lineCurrentA: number;
  /** Time for a 15 A breaker to open on the worst supply current (running or starting); null = never. */
  breakerTripS: number | null;
  /** A 30 mA residual-current device would open at once. */
  rcdTrips: boolean;
  /** Temperatures the motor would settle to with no protector and no failure [C]. */
  steady: { winding: number; core: number; hot: number };
  /** Insulation life at the hottest insulation temperature [h]; null when that temperature would destroy it outright. */
  lifeHours: number | null;
}

/** Distribute the electrical losses into the thermal nodes. */
export function heatSources(s: LabSummary, extras: FaultExtras, coolingFactor: number): HeatSources {
  const { run, inputs, motor } = s;
  const mainCu = abs2(run.iMain) * motor.r1m;
  const auxR = inputs.method === 'split-phase' ? inputs.auxResistance : motor.r1a;
  const auxCu = abs2(run.iAux) * auxR;
  const w = Math.abs(s.startup.finalOmega);
  const friction = inputs.damping * w * w;
  const iron = THERMAL.baseCoreLossW * (inputs.voltage / 120) ** 2;
  let windingW = mainCu;
  let hot = extras.hot;
  // A start winding that stays energised heats a small share of the copper: treat it as its own hot spot.
  if (auxCu > 5) {
    if (hot) windingW += auxCu;
    else hot = { powerW: auxCu, host: 'winding', fraction: 0.3, label: 'Auxiliary winding' };
  } else windingW += auxCu;
  return { windingW, coreW: run.rotorCopperLoss + iron + friction, hot, coolingFactor };
}

export interface RunOptions {
  base?: LabInputs;
  motor?: MotorParams;
  /** Thermal horizon [s]; 0 or undefined = automatic. */
  horizonS?: number;
}

/** Everything the fault simulator shows for one scenario. */
export function runFault(id: FaultId | 'none', severity: number, opts: RunOptions = {}): FaultReport {
  const base = opts.base ?? BASELINE;
  const motor = opts.motor ?? EXAMPLE_MOTOR;
  const eff = applyFault(id, severity, base, motor);
  const summary = summarize(eff.inputs, eff.motor);
  const extras = eff.post(summary);
  const heat = heatSources(summary, extras, eff.coolingFactor);

  // One hour of heating decides how fast the fault develops; the plotted window is then fitted to that.
  const full = simulateThermal(heat, 3600, { samples: 2 });
  const horizon =
    opts.horizonS && opts.horizonS > 0
      ? opts.horizonS
      : full.failureS !== null
        ? Math.max(5, full.failureS * 1.25)
        : full.firstTripS !== null
          ? Math.min(3600, Math.max(60, full.firstTripS * 3))
          : 3600;
  const thermal: ThermalResult = {
    ...simulateThermal(heat, horizon),
    firstTripS: full.firstTripS,
    tripCount: full.tripCount,
    firstLimitS: full.firstLimitS,
    failureS: full.failureS,
    failureLabel: full.failureLabel,
    dutyFraction: full.dutyFraction,
    peakWindingC: full.peakWindingC,
    peakHotC: full.peakHotC,
  };
  const steady = steadyTemps(heat);
  const insulationC = Math.max(steady.winding, heat.hot && heat.hot.kind !== 'bearing' ? steady.hot : -Infinity);

  const iLine = { re: summary.run.iLine.re + extras.extraLineCurrentA, im: summary.run.iLine.im };
  const lineCurrentA = Math.hypot(iLine.re, iLine.im);
  const worst = Math.max(lineCurrentA, summary.startCurrent && !summary.running ? summary.startCurrent : 0);
  return {
    id,
    severity: clamp01(severity),
    severityText: describeSeverity(id, severity, base),
    summary,
    extras,
    heat,
    thermal,
    lineCurrentA,
    breakerTripS: breakerTripTime(worst),
    rcdTrips: extras.groundCurrentA !== null && extras.groundCurrentA >= RCD_TRIP_A,
    steady,
    lifeHours: insulationC < THERMAL.failC ? insulationLifeHours(insulationC) : null,
  };
}
