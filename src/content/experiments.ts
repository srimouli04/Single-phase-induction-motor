// Guided experiments: predict, run, observe, explain. Every number or comparison that the text states is a `claim`
// with a predicate over the measured rows, and the tests check all of them against the model, so the prose cannot
// drift away from the simulation.
import { measureField, measureLab, num, type LabRun, type MetricId, type Row } from '../simulations/experiments';
import { DEFAULT_INPUTS } from '../simulations/motorModel';
import type { Handoff } from '../state';

export type OptionId = 'a' | 'b' | 'c';
export interface Option {
  id: OptionId;
  text: string;
  /** Feedback shown when the student picks this option: why it is right, or why it is not. */
  why: string;
}
export interface Claim {
  text: string;
  holds: (rows: Row[]) => boolean;
}
export interface Opener {
  label: string;
  target: 'lab' | 'field' | 'faults';
  handoff: Handoff;
}
export type Run = (LabRun & { kind: 'lab' }) | { kind: 'field'; label: string; speed: number };

export interface Experiment {
  id: string;
  title: string;
  level: 'Starter' | 'Core' | 'Challenge';
  goal: string;
  /** What is held constant. */
  setup: string;
  question: string;
  options: [Option, Option, Option];
  correct: OptionId;
  runs: Run[];
  columns: MetricId[];
  /** What to do in the section the buttons open. */
  steps: string[];
  /** Statements about the measured rows; each one is verified by the tests. */
  claims: Claim[];
  why: string;
  takeaway: string;
  detail?: { eq: string; note: string };
  open: Opener[];
}

export function measureExperiment(e: Experiment): Row[] {
  return e.runs.map((r) => (r.kind === 'field' ? measureField(r.label, r.speed) : measureLab(r)));
}

const LOAD = DEFAULT_INPUTS.loadTorque;
const HEAVY = 2;
const C0 = DEFAULT_INPUTS.capacitanceUF;
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const ratio = (rows: Row[], i: number, j: number, k: MetricId) => num(rows[i], k) / num(rows[j], k);
const increasing = (rows: Row[], k: MetricId) => rows.every((r, i) => i === 0 || num(r, k) > num(rows[i - 1], k));
const decreasing = (rows: Row[], k: MetricId) => rows.every((r, i) => i === 0 || num(r, k) < num(rows[i - 1], k));

export const EXPERIMENTS: Experiment[] = [
  {
    id: 'single-winding',
    title: 'Why one winding cannot start the motor',
    level: 'Starter',
    goal: 'See that a single pulsating field gives no torque at rest, yet pushes a rotor that is already turning.',
    setup: 'Main winding only, rotor free to turn. The idealised field model of Section 3, torques in relative units.',
    question: 'A motor has only its main winding connected. The rotor is at rest and the supply is switched on. What does the rotor do?',
    options: [
      {
        id: 'a',
        text: 'It speeds up slowly, because the field is weak.',
        why: 'The field is not weak. It is as strong as in any other motor, but at rest the two torques it produces cancel exactly. The trouble is the direction, not the strength.',
      },
      {
        id: 'b',
        text: 'It hums but stays at rest, and a push in either direction keeps it turning that way.',
        why: 'Yes. A pulsating field is two equal fields turning in opposite directions, so at rest their torques are equal and opposite. Once the rotor turns, one field gains on the other.',
      },
      {
        id: 'c',
        text: 'It turns, but always in one fixed direction.',
        why: 'Nothing in a single winding picks a direction. The torque at rest is zero, and a push either way is followed.',
      },
    ],
    correct: 'b',
    runs: [
      { kind: 'field', label: 'At rest (0 %)', speed: 0 },
      { kind: 'field', label: 'Turning forward at 10 % of synchronous speed', speed: 0.1 },
      { kind: 'field', label: 'Turning backward at 10 %', speed: -0.1 },
    ],
    columns: ['forward', 'backward', 'net'],
    steps: [
      'Open Cross-section & field. It starts in the “Main winding only” view with the rotor at 0 % speed.',
      'Press Pause and drag the time slider: every flux arrow grows, shrinks and reverses together, and none of them travels round the gap.',
      'In the torque chart, find the forward, backward and net curves at 0 % speed.',
      'Set Rotor speed to +10 %, then to −10 %, and read the net torque.',
    ],
    claims: [
      {
        text: 'At rest the forward and backward torques are equal and opposite, so the net torque is zero.',
        holds: (r) => near(num(r[0], 'net'), 0, 1e-9) && num(r[0], 'forward') > 0 && near(num(r[0], 'forward'), -num(r[0], 'backward'), 1e-9),
      },
      { text: 'Turning forward, the net torque is positive: it pushes the rotor the way it is already turning.', holds: (r) => num(r[1], 'net') > 0 },
      { text: 'Turning backward, the net torque is negative: again it pushes the rotor the way it is already turning.', holds: (r) => num(r[2], 'net') < 0 },
      { text: 'The two results mirror each other, so the winding has no preferred direction.', holds: (r) => near(num(r[1], 'net'), -num(r[2], 'net'), 1e-9) },
      {
        text: 'As the rotor speeds up, the forward torque grows and the backward torque shrinks.',
        holds: (r) => num(r[1], 'forward') > num(r[0], 'forward') && Math.abs(num(r[1], 'backward')) < Math.abs(num(r[0], 'backward')),
      },
    ],
    why: 'The main winding makes one pulsating field. Mathematically that is two equal fields turning in opposite directions (the double-revolving-field idea). At rest the rotor has the same slip with respect to both, so they produce equal and opposite torques and the net is zero. Once the rotor turns, its slip with respect to the forward field falls and its slip with respect to the backward field rises. The forward torque grows, the backward torque shrinks, and the net torque pushes the rotor the way it already turns.',
    takeaway: 'A single-phase motor needs help only to start. Once it is turning, the main winding alone keeps it going.',
    detail: {
      eq: 'T_{net} = A_F² t(1 − r) − A_B² t(1 + r)',
      note: 'For one winding A_F = A_B, so at r = 0 the two terms cancel. For a small r > 0, t(1 − r) is larger than t(1 + r) and the net torque is positive.',
    },
    open: [{ label: 'Open Cross-section & field', target: 'field', handoff: { field: { mode: 'pulsating', rotorSpeed: 0 } } }],
  },

  {
    id: 'auxiliary-winding',
    title: 'An auxiliary winding makes it start',
    level: 'Starter',
    goal: 'Add a second winding with extra resistance (split-phase) and see what it does to starting torque and current.',
    setup: `Example motor, 120 V, 60 Hz, 4 poles, load ${LOAD} N·m.`,
    question: `With the ${LOAD} N·m load, the motor with only its main winding does not start. A high-resistance auxiliary winding is now connected at start-up (split-phase). What happens at switch-on?`,
    options: [
      {
        id: 'a',
        text: 'It still cannot start, because the extra winding carries too little current to matter.',
        why: 'The auxiliary winding carries a healthy current. What matters is that this current is shifted in time from the main current, which gives the field a rotating part and so a starting torque.',
      },
      {
        id: 'b',
        text: 'It starts, and the starting current is between six and seven times the running current.',
        why: 'Yes. A rotor at rest acts like the short-circuited secondary of a transformer, so the current is several times the running current, which is small because a turning rotor opposes the supply.',
      },
      {
        id: 'c',
        text: 'It starts, and the starting current is lower than the running current.',
        why: 'The opposite. Running current is the smallest current the motor ever draws. At standstill nothing opposes the supply, so the current is far higher.',
      },
    ],
    correct: 'b',
    runs: [
      { kind: 'lab', label: 'Main winding only', patch: { method: 'main-only' } },
      { kind: 'lab', label: 'Split-phase (resistance start)', patch: { method: 'split-phase' } },
    ],
    columns: ['startTorque', 'startCurrent', 'leadDeg', 'outcome', 'speedRpm', 'steadyCurrent'],
    steps: [
      'Open the Physics lab. It starts with the main winding only: read the result pill and the Starting torque in the Results panel.',
      'Change Starting method to “Split-phase (resistance start)”.',
      'Read Starting torque, Starting current and Running current again.',
      'In the “Torque against speed” chart, compare the dashed “With start circuit” curve with the solid “Main winding only” curve at 0 rpm.',
    ],
    claims: [
      { text: 'Without the auxiliary winding the starting torque is zero and the motor does not start.', holds: (r) => r[0].outcome === 'no-start' && near(num(r[0], 'startTorque'), 0, 1e-6) },
      { text: 'With it, the starting torque is well above the load torque, so the motor starts and settles.', holds: (r) => r[1].outcome === 'settles' && num(r[1], 'startTorque') > 1.5 * LOAD },
      { text: 'The starting current is between six and seven times the running current.', holds: (r) => num(r[1], 'startCurrent') / num(r[1], 'steadyCurrent') >= 6 && num(r[1], 'startCurrent') / num(r[1], 'steadyCurrent') <= 7 },
      { text: 'The auxiliary current leads the main current by only about 20°, far from the ideal 90°.', holds: (r) => num(r[1], 'leadDeg') >= 18 && num(r[1], 'leadDeg') <= 25 },
    ],
    why: 'The auxiliary winding is made of thinner wire, so its resistance is high compared with its reactance. Its current therefore lags the supply by less than the main current does, which makes it lead the main current by a small angle. Two currents out of step in time, in windings out of step in space, make a field with a rotating part, and that gives a starting torque. When the speed reaches the cut-out speed, the centrifugal switch disconnects the auxiliary winding and the main winding runs the motor on its own.',
    takeaway: 'A phase shift between two windings is what makes a single-phase motor start; a resistance-start winding gives only a small one.',
    detail: {
      eq: 'T_{start} ∝ I_m I_a sin φ',
      note: 'φ is the angle by which the auxiliary current leads the main current. Here φ is about 20°, so sin φ is only about one third.',
    },
    open: [{ label: 'Open the Physics lab (main winding only)', target: 'lab', handoff: { lab: { method: 'main-only' } } }],
  },

  {
    id: 'capacitor-vs-resistance',
    title: 'Capacitor-start or split-phase?',
    level: 'Core',
    goal: 'Compare the two commonest ways of starting and find out why the capacitor is worth its cost.',
    setup: `Example motor, 120 V, 60 Hz, 4 poles, load ${LOAD} N·m, start capacitor ${C0} µF.`,
    question: 'Replace the split-phase starting branch with a capacitor-start branch. Compared with the split-phase motor, the starting torque and current become:',
    options: [
      {
        id: 'a',
        text: 'About the same starting torque and about the same current.',
        why: 'Resistance shifts the auxiliary current by only about 20°. A capacitor shifts it by nearly a quarter of a cycle, which is a very different field.',
      },
      {
        id: 'b',
        text: 'About twice the starting torque, with a lower starting current.',
        why: 'Yes. The phase shift is much closer to 90°, so the field is rounder. The auxiliary current leads the supply while the main current lags it, so in the line they partly cancel instead of adding.',
      },
      {
        id: 'c',
        text: 'About twice the starting torque, with about twice the current.',
        why: 'The torque doubles but the current does not. With a capacitor the two winding currents are almost 90° apart, so their sum in the line is smaller than in the split-phase motor, where they are nearly in step and add.',
      },
    ],
    correct: 'b',
    runs: [
      { kind: 'lab', label: 'Split-phase (resistance start)', patch: { method: 'split-phase' } },
      { kind: 'lab', label: `Capacitor-start, ${C0} µF`, patch: { method: 'capacitor-start', capacitanceUF: C0 } },
    ],
    columns: ['startTorque', 'startCurrent', 'auxStartCurrent', 'leadDeg', 'outcome'],
    steps: [
      'Open the Physics lab with the split-phase motor and note Starting torque and Starting current.',
      'Change Starting method to “Capacitor-start” and compare both numbers.',
      'Set the waveforms to “Standstill” and compare when the main and auxiliary winding currents peak.',
      'In the “Torque against speed” chart, compare how high the curves start at 0 rpm.',
    ],
    claims: [
      { text: 'The capacitor-start motor has about twice the starting torque of the split-phase motor.', holds: (r) => ratio(r, 1, 0, 'startTorque') >= 1.8 && ratio(r, 1, 0, 'startTorque') <= 2.4 },
      { text: 'Its starting current is lower.', holds: (r) => num(r[1], 'startCurrent') < num(r[0], 'startCurrent') },
      { text: 'Its auxiliary current is smaller, but it leads the main current by close to 90° instead of about 20°.', holds: (r) => num(r[1], 'auxStartCurrent') < num(r[0], 'auxStartCurrent') && num(r[1], 'leadDeg') >= 75 && num(r[1], 'leadDeg') <= 90 && num(r[0], 'leadDeg') >= 15 && num(r[0], 'leadDeg') <= 30 },
      { text: 'Both motors start and settle at the same speed.', holds: (r) => r[0].outcome === 'settles' && r[1].outcome === 'settles' && near(num(r[0], 'speedRpm'), num(r[1], 'speedRpm'), 1) },
    ],
    why: 'Torque depends on how big the auxiliary current is and on how far it leads the main current (the sine of that angle). Resistance gives a larger current but a lead of only about 20°. The capacitor gives a smaller current but a lead close to 90°, so the field is much rounder and the torque roughly doubles. In the line, the lagging main current and the leading auxiliary current partly cancel, so the starting current falls as well. Once running, both motors settle at the same speed, because the auxiliary winding is switched out.',
    takeaway: 'A capacitor buys more starting torque for less current. That is why capacitor-start motors drive loads that are hard to start.',
    detail: {
      eq: 'T_{start} ∝ I_m I_a sin φ,   X_C = 1 / (2π f C)',
      note: 'The capacitor’s reactance X_C is subtracted from the winding’s reactance, so the auxiliary current can lead the supply voltage, which a resistor alone can never do.',
    },
    open: [{ label: 'Open the Physics lab (split-phase)', target: 'lab', handoff: { lab: { method: 'split-phase' } } }],
  },

  {
    id: 'capacitor-size',
    title: 'How big should the start capacitor be?',
    level: 'Core',
    goal: 'Change the capacitance and find out whether more is better.',
    setup: `Capacitor-start motor, 120 V, 60 Hz, 4 poles, load ${LOAD} N·m. Only the capacitance changes.`,
    question: `The start capacitor is doubled from ${C0} µF to ${2 * C0} µF. What happens to the starting torque?`,
    options: [
      {
        id: 'a',
        text: 'It doubles.',
        why: 'The torque depends on the phase shift as well as on the size of the auxiliary current, and a bigger capacitor changes the shift. Doubling the capacitance does not double anything useful.',
      },
      {
        id: 'b',
        text: 'It rises by about a quarter.',
        why: 'Torque stops rising before that. Between 150 µF and its peak it gains only a few percent, and then it falls again.',
      },
      {
        id: 'c',
        text: 'It does not improve, while the starting current goes up.',
        why: 'Yes. A bigger capacitor draws more auxiliary current, but the lead over the main current shrinks, and the torque follows both. Past the peak you pay for more current and get no more torque.',
      },
    ],
    correct: 'c',
    runs: [50, 100, C0, 200, 2 * C0].map((c) => ({ kind: 'lab' as const, label: `${c} µF`, patch: { capacitanceUF: c } })),
    columns: ['startTorque', 'startCurrent', 'auxStartCurrent', 'leadDeg', 'outcome'],
    steps: [
      'Open the Physics lab with the capacitor-start motor at its default 150 µF.',
      'Set Start capacitor to 300 µF and read Starting torque and Starting current.',
      'Try 50 µF, 100 µF and 200 µF as well and note where the starting torque is largest.',
      'Set the waveforms to “Standstill”: as the capacitor grows, the auxiliary current grows but moves back towards the main current.',
    ],
    claims: [
      { text: 'Doubling the capacitor from 150 µF to 300 µF leaves the starting torque the same, within 3 %.', holds: (r) => near(ratio(r, 4, 2, 'startTorque'), 1, 0.03) },
      { text: 'The same change raises the starting current by about a fifth.', holds: (r) => ratio(r, 4, 2, 'startCurrent') >= 1.1 && ratio(r, 4, 2, 'startCurrent') <= 1.3 },
      { text: 'The starting torque is largest near 200 µF.', holds: (r) => r.every((x) => num(x, 'startTorque') <= num(r[3], 'startTorque')) },
      { text: 'From 150 µF to the peak the torque gains less than 10 %.', holds: (r) => ratio(r, 3, 2, 'startTorque') > 1 && ratio(r, 3, 2, 'startTorque') < 1.1 },
      { text: 'A capacitor of 50 µF gives only about a third of the torque at 150 µF.', holds: (r) => ratio(r, 0, 2, 'startTorque') >= 0.25 && ratio(r, 0, 2, 'startTorque') <= 0.45 },
      { text: 'A bigger capacitor always raises the auxiliary current and lowers its lead over the main current.', holds: (r) => increasing(r, 'auxStartCurrent') && decreasing(r, 'leadDeg') },
    ],
    why: 'Torque depends on the auxiliary current and on the sine of its lead over the main current. A larger capacitor has a smaller reactance, so the auxiliary current grows, but the capacitor then matters less compared with the winding’s own inductance and the lead shrinks. With a small capacitor the lead is large but the current is tiny; with a large one the current is large but the lead is small. The torque peaks in between. Bigger is better only up to that point, and past it the extra current only heats the windings.',
    takeaway: 'There is an optimum capacitance. Beyond it, more microfarads cost current and heat and buy nothing.',
    detail: {
      eq: 'T_{start} ∝ I_m I_a sin φ,   I_a = V / |R_a + j(X_a − X_C)|',
      note: 'As C grows, X_C falls and I_a rises towards V / |R_a + j X_a|, which has a limit, while φ falls. The product I_a sin φ therefore has a maximum.',
    },
    open: [
      { label: 'Open the Physics lab (capacitor-start)', target: 'lab', handoff: { lab: { method: 'capacitor-start', capacitanceUF: C0 } } },
      { label: 'See a weak capacitor in the Fault simulator', target: 'faults', handoff: { fault: 'cap-weak' } },
    ],
  },

  {
    id: 'voltage-sag',
    title: 'A sagging supply voltage',
    level: 'Core',
    goal: 'Predict how torque depends on voltage, and see what a weak supply does to a loaded motor.',
    setup: `Capacitor-start motor, 60 Hz, 4 poles, a heavy load of ${HEAVY} N·m. Only the supply voltage changes.`,
    question: `The supply falls by 20 %, from ${DEFAULT_INPUTS.voltage} V to ${Math.round(0.8 * DEFAULT_INPUTS.voltage)} V. By what factor does the starting torque change?`,
    options: [
      {
        id: 'a',
        text: 'It falls to 0.8 of its value (a 20 % loss).',
        why: 'That would be so if torque were proportional to voltage. The flux is proportional to the voltage and so is the rotor current, so the torque follows the square.',
      },
      {
        id: 'b',
        text: 'It falls to 0.64 of its value (a 36 % loss).',
        why: 'Yes. Torque is proportional to the square of the voltage: 0.8 × 0.8 = 0.64.',
      },
      {
        id: 'c',
        text: 'It falls to 0.5 of its value.',
        why: 'That is too steep for a 20 % sag. Torque goes with the square of the voltage, and 0.8 squared is 0.64.',
      },
    ],
    correct: 'b',
    runs: [
      { kind: 'lab', label: '120 V (normal)', patch: { loadTorque: HEAVY, voltage: 120 } },
      { kind: 'lab', label: '108 V (−10 %)', patch: { loadTorque: HEAVY, voltage: 108 } },
      { kind: 'lab', label: '96 V (−20 %)', patch: { loadTorque: HEAVY, voltage: 96 } },
    ],
    columns: ['startTorque', 'breakdown', 'outcome', 'speedRpm', 'slipPct', 'steadyCurrent'],
    steps: [
      `Open the Physics lab at ${DEFAULT_INPUTS.voltage} V with the ${HEAVY} N·m load. Note Starting torque, Rotor speed and Running current.`,
      'Lower Supply voltage to 108 V, then to 96 V, and read the same results each time.',
      'In the “Speed against time” chart, watch what the speed does at 96 V.',
      'In the “Torque against speed” chart, notice that the whole curve shrinks, not only its left end.',
    ],
    claims: [
      { text: 'At 96 V the starting torque is 0.64 of its value at 120 V.', holds: (r) => near(ratio(r, 2, 0, 'startTorque'), 0.64, 0.005) },
      { text: 'At 108 V it is 0.81 of its value at 120 V.', holds: (r) => near(ratio(r, 1, 0, 'startTorque'), 0.81, 0.005) },
      { text: 'The breakdown torque falls by the same factors, 0.81 and 0.64.', holds: (r) => near(ratio(r, 1, 0, 'breakdown'), 0.81, 0.005) && near(ratio(r, 2, 0, 'breakdown'), 0.64, 0.005) },
      { text: 'At normal voltage the heavy load starts and settles.', holds: (r) => r[0].outcome === 'settles' },
      { text: 'At 108 V it still settles, but with more slip and more current.', holds: (r) => r[1].outcome === 'settles' && num(r[1], 'slipPct') > num(r[0], 'slipPct') && num(r[1], 'steadyCurrent') > num(r[0], 'steadyCurrent') },
      { text: 'At 96 V it no longer settles: the speed falls until the centrifugal switch closes again, and the motor keeps cycling.', holds: (r) => r[2].outcome === 'cycles' },
    ],
    why: 'In the equivalent circuit every current is proportional to the voltage, and torque is proportional to the product of flux and rotor current, so it goes with the square of the voltage. A 20 % sag costs 36 % of the torque, and the breakdown torque shrinks in the same way. A motor with plenty of margin at normal voltage can run out of margin on a weak supply: it slows down, draws more current, and in a capacitor-start motor the slowing can bring the centrifugal switch back in.',
    takeaway: 'Voltage matters twice over: torque goes with its square. Long cables and weak supplies hurt hard-to-start loads first.',
    detail: {
      eq: 'T ∝ V²',
      note: 'Exact in this model because it has no magnetic saturation. In a real motor saturation makes the fall-off somewhat different, but the square law is the right first estimate.',
    },
    open: [
      { label: 'Open the Physics lab (120 V, heavy load)', target: 'lab', handoff: { lab: { loadTorque: HEAVY, voltage: 120 } } },
      { label: 'See low voltage in the Fault simulator', target: 'faults', handoff: { fault: 'low-voltage' } },
    ],
  },

  {
    id: 'heavier-load',
    title: 'A heavier load: slip and current',
    level: 'Core',
    goal: 'Predict how speed and current respond when the load torque goes up.',
    setup: 'Capacitor-start motor, 120 V, 60 Hz, 4 poles. Only the load torque changes.',
    question: 'The load torque doubles from 0.8 N·m to 1.6 N·m while the motor is running. What happens to the speed and the current?',
    options: [
      {
        id: 'a',
        text: 'The speed falls to about half and the current doubles.',
        why: 'An induction motor holds its speed far better than that. A small extra slip is enough to produce a lot more torque.',
      },
      {
        id: 'b',
        text: 'The speed falls by only a few percent and the current rises by about a third.',
        why: 'Yes. Near synchronous speed the torque rises steeply with slip, so a small drop in speed is enough. The rotor needs more current for more torque, and the stator current follows it.',
      },
      {
        id: 'c',
        text: 'Both stay the same, because the supply fixes the speed.',
        why: 'The supply fixes the speed of the field, not of the rotor. The rotor always runs a little slower, and by more when the load is heavier.',
      },
    ],
    correct: 'b',
    runs: [0.4, 0.8, 1.6, 2.4].map((l) => ({ kind: 'lab' as const, label: `Load ${l.toFixed(1)} N·m`, patch: { loadTorque: l } })),
    columns: ['outcome', 'speedRpm', 'slipPct', 'steadyCurrent', 'startTorque'],
    steps: [
      'Open the Physics lab at 0.8 N·m and note Rotor speed, Slip and Running current.',
      'Raise Load torque to 1.6 N·m and read them again.',
      'Keep raising the load towards 2.4 N·m and in the “Torque against speed” chart watch the operating point climb the curve.',
      'Compare the load with the Breakdown torque: the Overload margin falls towards 1.',
    ],
    claims: [
      { text: 'Doubling the load from 0.8 to 1.6 N·m lowers the speed by only a few percent (between 2 % and 6 %).', holds: (r) => 1 - ratio(r, 2, 1, 'speedRpm') >= 0.02 && 1 - ratio(r, 2, 1, 'speedRpm') <= 0.06 },
      { text: 'It raises the running current by about a third.', holds: (r) => ratio(r, 2, 1, 'steadyCurrent') >= 1.25 && ratio(r, 2, 1, 'steadyCurrent') <= 1.45 },
      { text: 'It roughly doubles the slip.', holds: (r) => ratio(r, 2, 1, 'slipPct') >= 1.8 && ratio(r, 2, 1, 'slipPct') <= 2.5 },
      { text: 'Every step up in load lowers the speed and raises the current, and all four loads settle.', holds: (r) => r.every((x) => x.outcome === 'settles') && decreasing(r, 'speedRpm') && increasing(r, 'steadyCurrent') },
    ],
    why: 'Near synchronous speed the torque of an induction motor is roughly proportional to slip, so doubling the load roughly doubles the slip, which is still a small fraction of the speed. The extra torque needs extra rotor current, and the stator has to supply it. That is why induction motors are called constant-speed machines, and why their current climbs with load. The speed cannot keep falling for ever: beyond the breakdown torque the motor can no longer follow the load.',
    takeaway: 'Speed barely moves with load; current moves a lot. Watch the current and the overload margin, not the speed.',
    detail: {
      eq: 'T ≈ K s   (small s),   P_{rotor loss} = s P_{air gap}',
      note: 'K depends on the motor (rotor resistance and flux). The same law is why a motor running at high slip is inefficient: s times the air-gap power is lost as heat in the rotor.',
    },
    open: [
      { label: 'Open the Physics lab at 0.8 N·m', target: 'lab', handoff: { lab: { loadTorque: LOAD } } },
      { label: 'See an overload in the Fault simulator', target: 'faults', handoff: { fault: 'overload' } },
    ],
  },

  {
    id: 'stuck-switch',
    title: 'A stuck centrifugal switch',
    level: 'Challenge',
    goal: 'Compare the two ways the starting switch can fail, and see why one of them is the dangerous one.',
    setup: `Capacitor-start motor, ${C0} µF, 120 V, 60 Hz, 4 poles, load ${LOAD} N·m.`,
    question: 'The centrifugal switch sticks, either open or closed. Which statement is true?',
    options: [
      {
        id: 'a',
        text: 'Stuck open: the motor will not start. Stuck closed: it starts, but draws about four times its normal running current.',
        why: 'Yes. If the switch never closes, the auxiliary winding is never connected and the motor behaves like a main-winding-only motor. If it never opens, the auxiliary branch stays in circuit and keeps carrying current.',
      },
      {
        id: 'b',
        text: 'Stuck open: it starts, but slowly. Stuck closed: it cannot start.',
        why: 'The other way round. A switch that is stuck open means no auxiliary winding at standstill, so no starting torque. A switch that is stuck closed gives the full starting torque.',
      },
      {
        id: 'c',
        text: 'Neither matters once the motor is running.',
        why: 'A stuck-open switch means the motor does not start at all. A stuck-closed switch leaves the start circuit energised, which is what damages the motor.',
      },
    ],
    correct: 'a',
    runs: [
      { kind: 'lab', label: 'Switch normal', patch: { switchFault: 'none' } },
      { kind: 'lab', label: 'Switch stuck open', patch: { switchFault: 'stuck-open' } },
      { kind: 'lab', label: 'Switch stuck closed', patch: { switchFault: 'stuck-closed' } },
    ],
    columns: ['startTorque', 'outcome', 'speedRpm', 'steadyCurrent', 'efficiency'],
    steps: [
      'Open the Physics lab with a normal switch and note Starting torque, Running current and Efficiency.',
      'Open “Fault switches” and set Centrifugal switch to “Stuck open”. Read the result pill and Current while stuck.',
      'Set it to “Stuck closed” and read Running current and Efficiency again.',
      'In the “Winding currents at the operating speed” chart, look for a large auxiliary winding current while the motor runs.',
    ],
    claims: [
      { text: 'Stuck open: no auxiliary current at start, so no starting torque, and the motor hums at a high current.', holds: (r) => r[1].outcome === 'no-start' && near(num(r[1], 'startTorque'), 0, 1e-6) && num(r[1], 'steadyCurrent') > 3 * num(r[0], 'steadyCurrent') },
      { text: 'Stuck closed: the motor starts with the same starting torque as a healthy one.', holds: (r) => r[2].outcome === 'settles' && near(num(r[2], 'startTorque'), num(r[0], 'startTorque'), 1e-9) },
      { text: 'Stuck closed: the running current is about four times normal.', holds: (r) => ratio(r, 2, 0, 'steadyCurrent') >= 3.5 && ratio(r, 2, 0, 'steadyCurrent') <= 4.5 },
      { text: 'Stuck closed: the efficiency estimate falls to less than a quarter of normal.', holds: (r) => num(r[2], 'efficiency') < 0.25 * num(r[0], 'efficiency') },
    ],
    why: 'The auxiliary winding is made of thin wire and the start capacitor is built for only a few seconds of duty each time. With the switch stuck open they are never used and the motor cannot start. With the switch stuck closed they are used for ever: the motor runs, so the fault is easy to miss, but the auxiliary winding carries a large current through its resistance and heats up, and the capacitor is overloaded. The usual end is a failed capacitor or a burnt auxiliary winding.',
    takeaway: 'A switch stuck open stops the motor. A switch stuck closed lets it run, and quietly cooks it. The second is the more dangerous failure.',
    detail: {
      eq: 'P_{aux} = I_a² R_a',
      note: 'With the switch closed, I_a stays large and all of I_a² R_a becomes heat in a winding that was designed to carry its current for only a second or two.',
    },
    open: [
      { label: 'Open the Physics lab (switch normal)', target: 'lab', handoff: { lab: { method: 'capacitor-start', switchFault: 'none' } } },
      { label: 'See a stuck-open switch in the Fault simulator', target: 'faults', handoff: { fault: 'switch-open' } },
      { label: 'See a stuck-closed switch in the Fault simulator', target: 'faults', handoff: { fault: 'switch-closed' } },
    ],
  },

  {
    id: 'reversing',
    title: 'Reversing the direction',
    level: 'Starter',
    goal: 'Find out how a single-phase induction motor is made to turn the other way.',
    setup: `Capacitor-start motor, ${C0} µF, 120 V, 60 Hz, 4 poles, load ${LOAD} N·m.`,
    question: 'How do you make a capacitor-start motor turn in the opposite direction?',
    options: [
      {
        id: 'a',
        text: 'Swap the two supply wires.',
        why: 'That reverses the current in both windings at the same time, which leaves the order in which their fields peak unchanged. The motor turns the same way.',
      },
      {
        id: 'b',
        text: 'Swap the connections of the auxiliary winding relative to the main winding.',
        why: 'Yes. That reverses the field of the auxiliary winding alone, so the rotating field, and with it the starting torque, turns the other way.',
      },
      {
        id: 'c',
        text: 'Use a bigger capacitor.',
        why: 'A bigger capacitor changes the size of the auxiliary current and its phase shift, but not the order in which the fields peak. The direction stays the same.',
      },
    ],
    correct: 'b',
    runs: [
      { kind: 'lab', label: 'Normal connection', patch: { auxReversed: false } },
      { kind: 'lab', label: 'Auxiliary leads swapped', patch: { auxReversed: true } },
    ],
    columns: ['startTorque', 'outcome', 'speedRpm', 'steadyCurrent'],
    steps: [
      'Open the Physics lab with the normal connection and note the signs of Starting torque and speed in the “Speed against time” chart.',
      'Switch on “Swap auxiliary leads (reverses direction)”.',
      'Compare the sign of the speed in the chart, and the size of the Rotor speed, Running current and Starting torque.',
      'In Cross-section & field, choose the “Swap auxiliary leads” preset: the same circle turns the other way.',
    ],
    claims: [
      { text: 'Swapping the leads reverses the sign of the starting torque and leaves its size unchanged.', holds: (r) => near(num(r[1], 'startTorque'), -num(r[0], 'startTorque'), 1e-6) && num(r[0], 'startTorque') > 0 },
      { text: 'The motor settles at the same speed in the opposite direction.', holds: (r) => r[0].outcome === 'settles' && r[1].outcome === 'settles' && near(num(r[1], 'speedRpm'), -num(r[0], 'speedRpm'), 1) },
      { text: 'The running current is the same in both directions.', holds: (r) => near(num(r[1], 'steadyCurrent'), num(r[0], 'steadyCurrent'), 0.05) },
    ],
    why: 'The direction of the rotating field depends on which winding’s current peaks first and where the windings are in space. Reversing the connections of one winding turns its field round by 180°, which reverses the sign of the starting torque and sends the motor the other way. Swapping the supply wires turns both fields round together and changes nothing. A running motor keeps going in its direction on the main winding alone, so reversing means stopping first and then starting with the swapped connection. That is how reversing washing-machine and garage-door motors work.',
    takeaway: 'Reverse one winding, not the supply. The motor must be at rest, or nearly, for the reversal to take.',
    detail: {
      eq: 'T_{start} ∝ − B_m B_a sin γ sin φ',
      note: 'Swapping the auxiliary leads changes the sign of B_a, which changes the sign of the whole expression. Swapping the supply wires changes the sign of both B_m and B_a, and the product does not change.',
    },
    open: [
      { label: 'Open the Physics lab (normal connection)', target: 'lab', handoff: { lab: { auxReversed: false } } },
      { label: 'See the field turn the other way', target: 'field', handoff: { field: { mode: 'twoWinding', inputs: { imAmp: 1, iaAmp: 1, phaseDeg: -90, axisDeg: 90 } } } },
    ],
  },
];

export const EXPERIMENT_BY_ID = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e])) as Record<string, Experiment>;
