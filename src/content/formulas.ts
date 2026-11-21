// Formula sheet and the search over it and the glossary.
// Every worked example is computed from the functions the Physics lab uses, with the numbers rounded as they are printed, so
// the arithmetic on the page can be redone by hand. tests/reference.test.ts redoes it from the printed text and compares the
// result with hand calculations, so the sheet cannot drift away from the app.
import type { Handoff } from '../state';
import { abs } from '../simulations/complex';
import { torqueIndex } from '../simulations/field';
import { lineCurrent, summarize } from '../simulations/metrics';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, backwardSlip, electricalFor, radPerSecToRpm, rotorSpeedFromSlip, slipFromSpeeds, solveAtSlip, syncOmega, synchronousSpeedRpm } from '../simulations/motorModel';
import { GLOSSARY, type GlossaryEntry } from './glossary';
import type { SectionId } from './sections';

export type FormulaGroupId = 'speed' | 'field' | 'torque' | 'power';

export const FORMULA_GROUPS: Record<FormulaGroupId, string> = {
  speed: 'Speed and slip',
  field: 'Field and starting',
  torque: 'Torque and motion',
  power: 'Power',
};

export interface Example {
  /** Plain-text setting, such as "Example motor, main winding only". */
  setting?: string;
  /** Known quantities as [symbol, value with unit]. The symbol is written for `Eq`. */
  given: [symbol: string, value: string][];
  /** Written for `Eq`. The arithmetic after the last "=" is the calculation, and the tests redo it. */
  working: string;
  value: number;
  unit: string;
  digits: number;
  remark?: string;
}

export interface TryIt {
  label: string;
  target: SectionId;
  handoff?: Handoff;
}

export interface Formula {
  id: string;
  name: string;
  group: FormulaGroupId;
  /** Written for `Eq`. */
  expr: string;
  symbols: [symbol: string, meaning: string][];
  use: string;
  /** Assumptions and limits, shown at the Detailed level. */
  note?: string;
  example?: Example;
  /** Extra words that should find this formula, such as the names of Greek letters. */
  keywords?: string[];
  /** Glossary ids. */
  related?: string[];
  tryIt?: TryIt;
}

/** A number as the sheet prints it. Using it for both the text and the arithmetic keeps the two the same. */
const r = (x: number, digits: number): number => Number(x.toFixed(digits));

/** The result of an example as printed: "1800 rpm", "50 %", "90°". */
export function resultText(e: Example): string {
  const n = e.value.toFixed(e.digits);
  return e.unit === '' ? n : e.unit === '°' ? `${n}°` : `${n} ${e.unit}`;
}

// ---- the numbers behind the examples ----
const F = DEFAULT_INPUTS.frequencyHz;
const POLES = DEFAULT_INPUTS.poles;
const NS = synchronousSpeedRpm(F, POLES);
const S = 0.03; // 3 % slip, as in the default lab setting (rounded)
const NR = r(rotorSpeedFromSlip(NS, S), 0);
/** The example motor with only its main winding, at the slip above. */
const MAIN = solveAtSlip(EXAMPLE_MOTOR, electricalFor(DEFAULT_INPUTS, EXAMPLE_MOTOR, false), S);
/** The Physics lab with its default settings. */
const LAB = summarize(DEFAULT_INPUTS);
const LAB_RPM = r(radPerSecToRpm(LAB.startup.finalOmega), 0);
const LAB_OUT = r(LAB.outputPower, 0);
const LAB_IN = r(LAB.run.inputPower, 0);
const LAB_AMPS = r(lineCurrent(LAB.run), 1);
const START_T = r(LAB.startTorque, 2);
const CAP_UF = DEFAULT_INPUTS.capacitanceUF;
const SWITCH = DEFAULT_INPUTS.cutoutFraction;

const OVERVIEW_SPEED: TryIt = { label: 'Overview: speed and slip calculator', target: 'overview' };
const LAB_DEFAULT: TryIt = { label: 'Physics lab: default settings', target: 'lab' };

export const FORMULAS: Formula[] = [
  // ---- Speed and slip ----
  {
    id: 'sync-speed',
    name: 'Synchronous speed',
    group: 'speed',
    expr: 'N_s = 120 f / P',
    symbols: [
      ['N_s', 'synchronous speed (rpm)'],
      ['f', 'supply frequency (Hz)'],
      ['P', 'number of poles (even)'],
    ],
    use: 'The speed of the rotating field. The rotor of a motor always runs a little slower.',
    example: { given: [['f', `${F} Hz`], ['P', `${POLES} poles`]], working: `N_s = 120 × ${F} ÷ ${POLES}`, value: NS, unit: 'rpm', digits: 0 },
    keywords: ['rpm', 'rotating field', 'poles', 'frequency'],
    related: ['syncSpeed', 'frequency', 'poles'],
    tryIt: OVERVIEW_SPEED,
  },
  {
    id: 'sync-omega',
    name: 'Synchronous angular speed',
    group: 'speed',
    expr: 'ω_s = 4π f / P = 2π N_s / 60',
    symbols: [
      ['ω_s', 'synchronous angular speed (rad/s)'],
      ['f', 'supply frequency (Hz)'],
      ['P', 'number of poles'],
      ['N_s', 'synchronous speed (rpm)'],
    ],
    use: 'The same speed in radians per second, the form that torque and power calculations need.',
    example: { given: [['f', `${F} Hz`], ['P', `${POLES} poles`]], working: `ω_s = 4π × ${F} ÷ ${POLES}`, value: syncOmega(F, POLES), unit: 'rad/s', digits: 1 },
    keywords: ['radians', 'angular', 'omega'],
    related: ['syncSpeed'],
  },
  {
    id: 'slip',
    name: 'Slip',
    group: 'speed',
    expr: 's = (N_s − N_r) / N_s',
    symbols: [
      ['s', 'slip, a fraction (multiply by 100 for per cent)'],
      ['N_s', 'synchronous speed (rpm)'],
      ['N_r', 'rotor speed (rpm)'],
    ],
    use: 'How far the rotor lags the field: 1 at standstill, a few per cent at normal load, 0 at synchronous speed.',
    note: 'The Physics lab’s curves run from s = 0 to s = 2, which is speed from synchronous speed forward down to synchronous speed in reverse. Slip above 1 means the rotor is turning against the forward field.',
    example: { given: [['N_s', `${NS} rpm`], ['N_r', `${NR} rpm`]], working: `s = (${NS} − ${NR}) ÷ ${NS}`, value: slipFromSpeeds(NS, NR), unit: '', digits: 2, remark: 'That is 3 %.' },
    keywords: ['lag', 'per cent', 'percentage', 'rpm'],
    related: ['slip', 'rotorSpeed', 'syncSpeed'],
    tryIt: OVERVIEW_SPEED,
  },
  {
    id: 'rotor-speed',
    name: 'Rotor speed from slip',
    group: 'speed',
    expr: 'N_r = N_s (1 − s)',
    symbols: [
      ['N_r', 'rotor speed (rpm)'],
      ['N_s', 'synchronous speed (rpm)'],
      ['s', 'slip (fraction)'],
    ],
    use: 'The shaft speed when the slip is known.',
    example: { given: [['N_s', `${NS} rpm`], ['s', `${S}`]], working: `N_r = ${NS} × (1 − ${S})`, value: NR, unit: 'rpm', digits: 0 },
    keywords: ['shaft speed', 'rpm'],
    related: ['rotorSpeed', 'slip'],
  },
  {
    id: 'rotor-frequency',
    name: 'Frequency of the rotor currents',
    group: 'speed',
    expr: 'f_r = s f',
    symbols: [
      ['f_r', 'frequency of the rotor currents made by the forward field (Hz)'],
      ['s', 'slip (fraction)'],
      ['f', 'supply frequency (Hz)'],
    ],
    use: 'The rotor currents alternate at the slip frequency: the full supply frequency at standstill and only a few hertz when running.',
    note: 'The backward field also induces rotor currents, at (2 − s) f, close to twice the supply frequency.',
    example: { given: [['f', `${F} Hz`], ['s', `${S}`]], working: `f_r = ${S} × ${F}`, value: S * F, unit: 'Hz', digits: 1 },
    keywords: ['induced', 'rotor current', 'hertz'],
    related: ['slip', 'inducedCurrent'],
  },
  {
    id: 'backward-slip',
    name: 'Slip of the backward field',
    group: 'speed',
    expr: 's_b = 2 − s',
    symbols: [
      ['s_b', 'slip of the backward-rotating field'],
      ['s', 'slip of the forward field (fraction)'],
    ],
    use: 'The backward field passes the rotor at nearly twice synchronous speed, so its slip is close to 2 and the torque it produces is small beside the forward field’s.',
    example: { given: [['s', `${S}`]], working: `s_b = 2 − ${S}`, value: backwardSlip(S), unit: '', digits: 2 },
    keywords: ['double revolving field', 'backward', 'forward'],
    related: ['doubleRevolvingField', 'forwardBackward', 'slip'],
    tryIt: { label: 'Field section: forward and backward torque', target: 'field', handoff: { field: { mode: 'double' } } },
  },

  // ---- Field and starting ----
  {
    id: 'electrical-angle',
    name: 'Electrical angle',
    group: 'field',
    expr: 'θ_e = (P / 2) θ_m',
    symbols: [
      ['θ_e', 'electrical angle (degrees)'],
      ['θ_m', 'mechanical angle round the stator (degrees)'],
      ['P', 'number of poles'],
    ],
    use: 'Windings are placed in electrical degrees. A 90° electrical offset between the main and auxiliary windings is a smaller real angle on a motor with more poles.',
    example: { given: [['P', `${POLES} poles`], ['θ_m', '45°']], working: `θ_e = (${POLES} ÷ 2) × 45`, value: (POLES / 2) * 45, unit: '°', digits: 0, remark: 'So a 90° electrical offset is only 45° of real angle on a 4-pole motor.' },
    keywords: ['degrees', 'winding axes', 'displacement', 'theta'],
    related: ['electricalAngle', 'poles'],
  },
  {
    id: 'pulsating-field',
    name: 'A pulsating field is two rotating fields',
    group: 'field',
    expr: 'B_m cos ωt cos θ = (B_m / 2) cos(θ − ωt) + (B_m / 2) cos(θ + ωt)',
    symbols: [
      ['B_m', 'peak flux density of the pulsating field (T)'],
      ['ω', 'supply angular frequency (rad/s)'],
      ['θ', 'position round the air gap (electrical angle)'],
    ],
    use: 'The basis of the double-revolving-field theory: one winding’s field is the sum of a forward and a backward rotating field, each with half the amplitude.',
    example: { given: [['B_m', '0.8 T']], working: 'B_m ÷ 2 = 0.8 ÷ 2', value: 0.8 / 2, unit: 'T', digits: 1, remark: 'For each of the two rotating fields.' },
    keywords: ['double revolving field', 'forward', 'backward', 'single winding', 'theta', 'omega'],
    related: ['pulsatingField', 'doubleRevolvingField', 'rotatingField'],
    tryIt: { label: 'Field section: the two rotating fields', target: 'field', handoff: { field: { mode: 'double' } } },
  },
  {
    id: 'start-torque-phase',
    name: 'Starting torque of two windings',
    group: 'field',
    expr: 'T_{start} ∝ B_m B_a sin γ sin φ',
    symbols: [
      ['B_m, B_a', 'field amplitudes of the main and auxiliary windings'],
      ['γ', 'angle between the two winding axes in space'],
      ['φ', 'time lead of the auxiliary current over the main current'],
    ],
    use: 'A displacement in space and a displacement in time are both needed. For γ = 90° and equal fields the starting torque goes with sin φ, and its sign gives the direction of rotation.',
    note: 'Valid at standstill, where the rotor responds equally to the forward and backward fields. The constant of proportionality depends on the rotor. Swapping the auxiliary leads reverses the sign of φ and so the torque.',
    example: {
      given: [['γ', '90°'], ['φ', '30°'], ['B_a / B_m', '1']],
      working: 'T ÷ T_{max} = sin 30°',
      value: 100 * Math.abs(torqueIndex({ imAmp: 1, iaAmp: 1, phaseDeg: 30, axisDeg: 90 })),
      unit: '%',
      digits: 0,
      remark: 'Of the largest starting torque these windings can give, which needs φ = 90°.',
    },
    keywords: ['phase shift', 'phase displacement', 'auxiliary winding', 'direction', 'gamma', 'phi'],
    related: ['phaseDisplacement', 'startingTorque', 'auxWinding'],
    tryIt: { label: 'Field section: two windings, 30° apart in time', target: 'field', handoff: { field: { mode: 'twoWinding', inputs: { phaseDeg: 30 } } } },
  },
  {
    id: 'capacitor-reactance',
    name: 'Capacitor reactance',
    group: 'field',
    expr: 'X_c = 1 / (2π f C)',
    symbols: [
      ['X_c', 'reactance of the capacitor (Ω)'],
      ['f', 'supply frequency (Hz)'],
      ['C', 'capacitance in farads (1 µF = 10⁻⁶ F)'],
    ],
    use: 'In the auxiliary branch the capacitor’s reactance works against the winding’s inductive reactance, so the auxiliary current can lead the main current by far more than a resistor alone would allow.',
    example: {
      given: [['f', `${F} Hz`], ['C', `${CAP_UF} µF`]],
      working: `X_c = 1 ÷ (2π × ${F} × ${CAP_UF}×10^{−6})`,
      value: 1 / (2 * Math.PI * F * CAP_UF * 1e-6),
      unit: 'Ω',
      digits: 1,
      remark: `In the example motor this puts the auxiliary current about ${r(LAB.start.auxLeadDeg, 0)}° ahead of the main current at standstill.`,
    },
    keywords: ['microfarad', 'µF', 'capacitance', 'start capacitor', 'run capacitor', 'phase shift'],
    related: ['capacitor', 'reactance', 'phaseDisplacement'],
    tryIt: { label: 'Starting methods: capacitor-start', target: 'starting', handoff: { starting: 'capacitor-start' } },
  },
  {
    id: 'switch-speed',
    name: 'Centrifugal-switch speed',
    group: 'field',
    expr: 'N_{switch} = k N_s',
    symbols: [
      ['N_{switch}', 'speed at which the switch opens (rpm)'],
      ['k', 'fraction of synchronous speed (0.75 in the example motor)'],
      ['N_s', 'synchronous speed (rpm)'],
    ],
    use: 'Above this speed the switch disconnects the start circuit and the main winding runs the motor alone.',
    note: 'In the model the switch closes again when the speed falls by 10 % of synchronous speed below the opening speed. A motor loaded so heavily that it cannot hold its speed above that point cycles on and off.',
    example: { given: [['k', `${SWITCH}`], ['N_s', `${NS} rpm`]], working: `N_{switch} = ${SWITCH} × ${NS}`, value: SWITCH * NS, unit: 'rpm', digits: 0 },
    keywords: ['cut-out', 'cutout', 'hysteresis', 'start winding'],
    related: ['centrifugalSwitch', 'syncSpeed'],
    tryIt: { label: 'Physics lab: watch the switch open', target: 'lab' },
  },

  // ---- Torque and motion ----
  {
    id: 'net-torque',
    name: 'Net torque of one winding',
    group: 'torque',
    expr: 'T_{net} = T_f − T_b',
    symbols: [
      ['T_{net}', 'torque on the rotor (N·m)'],
      ['T_f', 'torque of the forward field (N·m)'],
      ['T_b', 'torque of the backward field (N·m), subtracted'],
    ],
    use: 'At standstill the two torques are equal and the net is zero. As the rotor speeds up, the forward torque grows and the backward torque falls.',
    example: (() => {
      const tf = r(MAIN.torqueF, 3);
      const tb = r(MAIN.torqueB, 3);
      return {
        setting: 'Example motor, main winding only',
        given: [['s', `${S}`], ['T_f', `${tf} N·m`], ['T_b', `${tb} N·m`]],
        working: `T_{net} = ${tf} − ${tb}`,
        value: tf - tb,
        unit: 'N·m',
        digits: 3,
      } as Example;
    })(),
    keywords: ['forward', 'backward', 'double revolving field', 'standstill'],
    related: ['doubleRevolvingField', 'forwardBackward', 'torque'],
    tryIt: { label: 'Physics lab: main winding only', target: 'lab', handoff: { lab: { method: 'main-only' } } },
  },
  {
    id: 'field-torque',
    name: 'Torque of one rotating field',
    group: 'torque',
    expr: 'T_f = 2 R_F |I_f|² / ω_s,   T_b = 2 R_B |I_b|² / ω_s',
    symbols: [
      ['R_F, R_B', 'real parts of the forward and backward rotor-side impedances (Ω), written in full, not halved'],
      ['I_f, I_b', 'forward and backward current components (A rms)'],
      ['ω_s', 'synchronous angular speed (rad/s)'],
    ],
    use: 'The air-gap power of a rotating field divided by its speed. This is how the Physics lab finds the torque at every speed.',
    note: 'With the main winding only, each current component is half the main-winding current. With an auxiliary winding the two components come from the symmetrical-component equations listed under Model details in the Physics lab. The forward impedance is the rotor branch in parallel with the magnetising branch at slip s, and the backward impedance is the same at slip 2 − s.',
    example: (() => {
      const rf = r(MAIN.zF.re, 2);
      const i = r(abs(MAIN.iF), 3);
      const w = r(MAIN.omegaS, 1);
      return {
        setting: 'Example motor, main winding only',
        given: [['s', `${S}`], ['R_F', `${rf} Ω`], ['|I_f|', `${i} A`], ['ω_s', `${w} rad/s`]],
        working: `T_f = 2 × ${rf} × ${i}² ÷ ${w}`,
        value: (2 * rf * i * i) / w,
        unit: 'N·m',
        digits: 3,
      } as Example;
    })(),
    keywords: ['air gap power', 'equivalent circuit', 'resistance', 'omega'],
    related: ['equivalentCircuit', 'forwardBackward', 'torque'],
    tryIt: { label: 'Physics lab: main winding only', target: 'lab', handoff: { lab: { method: 'main-only' } } },
  },
  {
    id: 'equation-of-motion',
    name: 'Equation of motion',
    group: 'torque',
    expr: 'J dω/dt = T_{motor} − T_{load} − B ω',
    symbols: [
      ['J', 'inertia of rotor and load (kg·m²)'],
      ['ω', 'angular speed (rad/s)'],
      ['T_{motor}', 'torque of the motor at that speed (N·m)'],
      ['T_{load}', 'load torque (N·m)'],
      ['B', 'viscous friction coefficient (N·m·s/rad)'],
    ],
    use: 'The speed changes when the motor torque differs from the load torque. The Physics lab integrates it step by step to draw the speed–time curve.',
    note: 'The motor torque comes from the quasi-static model at the present speed, with the centrifugal switch included. Electrical transients are ignored. The load torque is taken to oppose whichever way the rotor turns.',
    example: {
      setting: 'Example motor, capacitor-start, at the instant of switch-on (default lab settings)',
      given: [['J', `${DEFAULT_INPUTS.inertia} kg·m²`], ['T_{motor}', `${START_T} N·m`], ['T_{load}', `${DEFAULT_INPUTS.loadTorque} N·m`], ['B', `${DEFAULT_INPUTS.damping} N·m·s/rad`], ['ω', '0 rad/s']],
      working: `dω/dt = (${START_T} − ${DEFAULT_INPUTS.loadTorque} − ${DEFAULT_INPUTS.damping} × 0) ÷ ${DEFAULT_INPUTS.inertia}`,
      value: (START_T - DEFAULT_INPUTS.loadTorque - DEFAULT_INPUTS.damping * 0) / DEFAULT_INPUTS.inertia,
      unit: 'rad/s²',
      digits: 0,
      remark: 'The initial angular acceleration. The friction term vanishes at ω = 0.',
    },
    keywords: ['inertia', 'acceleration', 'friction', 'dynamics', 'speed time', 'omega'],
    related: ['rotorInertia', 'damping', 'loadTorque'],
    tryIt: LAB_DEFAULT,
  },
  {
    id: 'voltage-torque',
    name: 'Torque and supply voltage',
    group: 'torque',
    expr: 'T_2 / T_1 = (V_2 / V_1)²',
    symbols: [
      ['T_1, T_2', 'torque at the two voltages (N·m)'],
      ['V_1, V_2', 'the two supply voltages (V)'],
    ],
    use: 'Starting and breakdown torque go with the square of the voltage, so a small sag costs a lot of torque.',
    note: 'Exact in this model because it has no magnetic saturation. In a real motor the fall-off is somewhat different.',
    example: { given: [['V_1', '120 V'], ['V_2', '96 V']], working: 'T_2 ÷ T_1 = (96 ÷ 120)²', value: 100 * (96 / 120) ** 2, unit: '%', digits: 0, remark: 'Of the starting torque at 120 V.' },
    keywords: ['sag', 'low voltage', 'square law', 'brown out'],
    related: ['startingTorque', 'breakdownTorque'],
    tryIt: { label: 'Physics lab at 96 V', target: 'lab', handoff: { lab: { voltage: 96 } } },
  },

  // ---- Power ----
  {
    id: 'shaft-power',
    name: 'Shaft power',
    group: 'power',
    expr: 'P_{out} = T ω = 2π N T / 60',
    symbols: [
      ['P_{out}', 'mechanical power at the shaft (W)'],
      ['T', 'torque at the shaft (N·m)'],
      ['ω', 'angular speed (rad/s)'],
      ['N', 'speed (rpm)'],
    ],
    use: 'The useful output of the motor. A horsepower is about 746 W.',
    example: {
      setting: 'Default lab settings, running',
      given: [['T', `${DEFAULT_INPUTS.loadTorque} N·m`], ['N', `${LAB_RPM} rpm`]],
      working: `P_{out} = 2π × ${LAB_RPM} × ${DEFAULT_INPUTS.loadTorque} ÷ 60`,
      value: (2 * Math.PI * LAB_RPM * DEFAULT_INPUTS.loadTorque) / 60,
      unit: 'W',
      digits: 0,
    },
    keywords: ['watts', 'horsepower', 'mechanical power', 'output'],
    related: ['torque', 'loadTorque', 'rotorSpeed'],
    tryIt: LAB_DEFAULT,
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    group: 'power',
    expr: 'η = P_{out} / P_{in}',
    symbols: [
      ['η', 'efficiency, a fraction (multiply by 100 for per cent)'],
      ['P_{out}', 'shaft power (W)'],
      ['P_{in}', 'electrical input power (W)'],
    ],
    use: 'The share of the input power that becomes shaft power. The rest is lost as heat.',
    note: 'The model has no iron loss and only a small friction term, so its efficiency is higher than a real motor of this size would reach.',
    example: { setting: 'Default lab settings, running', given: [['P_{out}', `${LAB_OUT} W`], ['P_{in}', `${LAB_IN} W`]], working: `η = ${LAB_OUT} ÷ ${LAB_IN}`, value: (100 * LAB_OUT) / LAB_IN, unit: '%', digits: 0 },
    keywords: ['losses', 'heat', 'per cent', 'eta'],
    related: ['powerFactor'],
    tryIt: LAB_DEFAULT,
  },
  {
    id: 'power-factor',
    name: 'Power factor',
    group: 'power',
    expr: 'PF = P / (V I)',
    symbols: [
      ['PF', 'power factor (0 to 1)'],
      ['P', 'real input power (W)'],
      ['V', 'rms supply voltage (V)'],
      ['I', 'rms line current (A)'],
    ],
    use: 'The share of the apparent power V I that does real work. Induction motors draw lagging current, so it is below 1.',
    example: { setting: 'Default lab settings, running', given: [['P', `${LAB_IN} W`], ['V', `${DEFAULT_INPUTS.voltage} V`], ['I', `${LAB_AMPS} A`]], working: `PF = ${LAB_IN} ÷ (${DEFAULT_INPUTS.voltage} × ${LAB_AMPS})`, value: LAB_IN / (DEFAULT_INPUTS.voltage * LAB_AMPS), unit: '', digits: 2 },
    keywords: ['lagging', 'apparent power', 'current'],
    related: ['powerFactor', 'reactance'],
    tryIt: LAB_DEFAULT,
  },
];

// ---- search ----

/** Text for matching: lower case, with the `_ { } ^` of formula markup removed, so "N_s" and "ns" meet. */
const plain = (s: string): string => s.replace(/[_{}^]/g, '').toLowerCase();

/** True when every word of the query is found in the text. */
const matchesAll = (text: string, query: string): boolean =>
  plain(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => text.includes(w));

const formulaText = (f: Formula): string =>
  plain([f.name, f.expr, f.use, f.note ?? '', ...f.symbols.flat(), ...(f.keywords ?? []), f.example?.setting ?? '', ...(f.example?.given.flat() ?? []), f.example?.remark ?? ''].join(' '));

/** Formulas that contain every word of `query` (an empty query matches all), optionally within one group. */
export function searchFormulas(query: string, group: FormulaGroupId | 'all' = 'all'): Formula[] {
  return FORMULAS.filter((f) => (group === 'all' || f.group === group) && matchesAll(formulaText(f), query));
}

/** Glossary entries that contain every word of `query` (an empty query matches all), in alphabetical order. */
export function searchGlossary(query: string): GlossaryEntry[] {
  return GLOSSARY.filter((g) => matchesAll(plain(`${g.term} ${g.short} ${g.long}`), query)).sort((a, b) => a.term.localeCompare(b.term));
}
