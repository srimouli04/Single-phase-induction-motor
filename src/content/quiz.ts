// Knowledge-check questions. The numeric answers and the statements about the example motor are checked against the
// simulation by tests/quiz.test.ts, so a change to the model cannot silently leave a wrong "right answer" here.
import type { SectionId } from './sections';

export type TopicId = 'parts' | 'field' | 'starting' | 'speed' | 'curves' | 'faults';
export type Level = 'Basic' | 'Intermediate' | 'Advanced';

export const TOPICS: Record<TopicId, string> = {
  parts: 'Parts and operation',
  field: 'Magnetic field',
  starting: 'Starting methods',
  speed: 'Speed and slip',
  curves: 'Torque and current curves',
  faults: 'Faults and protection',
};

interface Base {
  id: string;
  topic: TopicId;
  level: Level;
  prompt: string;
  /** A nudge that does not give the answer away. */
  hint: string;
  /** Why the right answer is right (and what the common wrong idea gets wrong). */
  explain: string;
  /** Section to revisit when this question was missed. */
  review: SectionId;
}
/** One right option. */
export interface SingleQuestion extends Base {
  type: 'single';
  options: string[];
  correct: number;
}
/** Select all that apply; marked all-or-nothing. `correct` is sorted. */
export interface MultiQuestion extends Base {
  type: 'multi';
  options: string[];
  correct: number[];
}
/** A typed number (no unit; the unit is shown beside the box), right within ±`tolerance`. */
export interface NumericQuestion extends Base {
  type: 'numeric';
  unit: string;
  answer: number;
  tolerance: number;
}
export type Question = SingleQuestion | MultiQuestion | NumericQuestion;

export const QUESTIONS: Question[] = [
  // ---- Parts and operation ----
  {
    id: 'supply-connection',
    topic: 'parts',
    level: 'Basic',
    type: 'single',
    prompt: 'Which part of a squirrel-cage single-phase induction motor is connected to the electrical supply?',
    options: ['The rotor bars', 'The stator windings', 'The shaft', 'The end shields'],
    correct: 1,
    hint: 'Think about which part turns, and whether a wire could reach it.',
    explain:
      'Only the stator windings are wired to the supply. The rotor is a closed cage of bars with no connection to the outside: the alternating field of the stator induces current in it, and that is what “induction motor” means.',
    review: 'overview',
  },
  {
    id: 'centrifugal-switch',
    topic: 'parts',
    level: 'Basic',
    type: 'single',
    prompt: 'What does the centrifugal switch do in a capacitor-start motor?',
    options: [
      'It limits the supply voltage while the motor is starting',
      'It reverses the rotation when the motor is switched off',
      'It disconnects the start winding and capacitor once the rotor has reached about three-quarters of synchronous speed',
      'It connects the capacitor to the supply only at full speed',
    ],
    correct: 2,
    hint: 'The start winding is made of fine wire and the start capacitor is built for seconds of use, not for continuous running.',
    explain:
      'Weights on the shaft swing outwards as it speeds up and open the switch contacts (at 75 % of synchronous speed in the example motor). The start winding and capacitor are sized for seconds of use, so they must be cut out. A switch that sticks open or closed is one of the faults in the fault simulator.',
    review: 'starting',
  },
  {
    id: 'stator-parts',
    topic: 'parts',
    level: 'Intermediate',
    type: 'multi',
    prompt: 'Which of these belong to the stator? Select all that apply.',
    options: ['Short-circuited rotor bars', 'Laminated iron core', 'Main winding', 'Auxiliary (start) winding', 'End rings of the cage'],
    correct: [1, 2, 3],
    hint: 'The stator is the part that stays still. The cage is the part that turns.',
    explain:
      'The stator is the fixed outer assembly: a core of thin insulated laminations that holds the main and auxiliary windings. The bars and the end rings that join them make up the squirrel cage, which is the rotor’s winding.',
    review: 'explorer',
  },

  // ---- Magnetic field ----
  {
    id: 'pulsating-field',
    topic: 'field',
    level: 'Basic',
    type: 'single',
    prompt: 'A single stator winding carries alternating current. What does its magnetic field in the air gap do?',
    options: ['It rotates at synchronous speed', 'It stays constant, like a permanent magnet', 'It disappears, because the current keeps changing direction', 'It stays on one axis, growing, shrinking and reversing with the current'],
    correct: 3,
    hint: 'At every instant the winding gives one flux direction along one fixed axis. What changes is its size and sign.',
    explain:
      'The field keeps a fixed direction and alternates in strength and sign: it pulsates. It does not travel round the gap, so on its own it gives a rotor at rest no preferred direction to turn in.',
    review: 'field',
  },
  {
    id: 'double-revolving',
    topic: 'field',
    level: 'Intermediate',
    type: 'single',
    prompt: 'In the double-revolving-field theory, how is the pulsating field of one winding described?',
    options: ['One rotating field plus one stationary field', 'Two equal fields turning in opposite directions at synchronous speed', 'Two fields turning the same way at different speeds', 'Three fields 120° apart'],
    correct: 1,
    hint: 'A pulsating field is the sum of two things that cancel in every direction except along the winding axis.',
    explain:
      'Two rotating fields, each of half the amplitude, turn in opposite directions. Along the winding axis they add up and give the pulsation; at right angles they cancel. The rotor sees slip s with respect to the forward field and 2 − s with respect to the backward one.',
    review: 'field',
  },
  {
    id: 'phase-shift-torque',
    topic: 'field',
    level: 'Intermediate',
    type: 'numeric',
    prompt:
      'Two identical windings, 90° apart in space, carry equal currents, and the auxiliary current leads the main current by 30°. What percentage of the largest possible starting torque (reached with a 90° shift) does this give?',
    unit: '%',
    answer: 50,
    tolerance: 1,
    hint: 'For equal currents in windings 90° apart, the starting torque is proportional to sin φ, where φ is the phase shift.',
    explain: 'The starting torque is proportional to sin φ, and sin 30° = 0.5, so the torque is 50 % of the maximum at φ = 90°. You can try 30° in the phase-shift demo in Section 1.',
    review: 'overview',
  },

  // ---- Starting methods ----
  {
    id: 'rotating-conditions',
    topic: 'starting',
    level: 'Intermediate',
    type: 'multi',
    prompt: 'A motor needs a rotating field at start-up. Which conditions must both hold for two windings to produce one? Select all that apply.',
    options: [
      'Both windings have exactly the same number of turns',
      'The two winding axes are displaced in space',
      'The two winding currents are shifted in time',
      'One winding is connected in series with a capacitor',
    ],
    correct: [1, 2],
    hint: 'Two windings on the same axis only make a bigger pulsating field. Two currents that peak together only make a field that grows and shrinks together.',
    explain:
      'A rotating field needs a displacement in space and a displacement in time. A capacitor is only one way to get the time shift: extra resistance in the auxiliary winding (split-phase) or a shading ring also works. The winding turns do not have to match, although a perfectly circular field needs equal strengths.',
    review: 'starting',
  },
  {
    id: 'shaded-pole',
    topic: 'starting',
    level: 'Basic',
    type: 'single',
    prompt: 'Which motor starts with a copper ring around part of each pole?',
    options: ['Shaded-pole', 'Split-phase', 'Capacitor-start', 'Permanent-split-capacitor (PSC)'],
    correct: 0,
    hint: 'It is the simplest and cheapest design: no start winding, no capacitor and no switch.',
    explain:
      'The ring carries an induced current that delays the flux in the shaded part of the pole. Two fluxes displaced in space and in time sweep a weak field across the pole face. It is used in small fans and appliances where starting torque and efficiency matter little.',
    review: 'starting',
  },
  {
    id: 'capacitor-vs-resistance',
    topic: 'starting',
    level: 'Intermediate',
    type: 'single',
    prompt: 'Why does a capacitor-start motor give much more starting torque than a split-phase motor of similar size?',
    options: [
      'The capacitor stores energy that kicks the rotor at switch-on',
      'The capacitor raises the voltage across the main winding',
      'The capacitor makes the auxiliary current lead the main current by a much larger angle, so the starting field is closer to circular',
      'The capacitor lets the rotor turn in both directions at once',
    ],
    correct: 2,
    hint: 'Starting torque grows with the sine of the angle between the two winding currents.',
    explain:
      'A resistive auxiliary winding gives only a small phase shift (about 20° in the example motor), while a capacitor in the auxiliary branch can give 80° or more. A larger shift makes the field more circular and the torque larger. Experiment 3 measures this.',
    review: 'starting',
  },
  {
    id: 'psc',
    topic: 'starting',
    level: 'Intermediate',
    type: 'single',
    prompt: 'Which type has no centrifugal switch and keeps one capacitor connected all the time?',
    options: ['Split-phase', 'Capacitor-start', 'Shaded-pole', 'Permanent-split-capacitor (PSC)'],
    correct: 3,
    hint: 'The word “permanent” is the clue.',
    explain:
      'In a PSC motor the run capacitor stays in series with the auxiliary winding, so there is nothing to switch. Running is quiet and smooth, but the capacitor is a compromise, so the starting torque is low and the type suits fans and light loads. Split-phase and capacitor-start motors disconnect their start circuit with a switch, and a shaded-pole motor has no capacitor at all.',
    review: 'starting',
  },

  // ---- Speed and slip ----
  {
    id: 'sync-speed',
    topic: 'speed',
    level: 'Basic',
    type: 'numeric',
    prompt: 'What is the synchronous speed of a 4-pole motor on a 60 Hz supply?',
    unit: 'rpm',
    answer: 1800,
    tolerance: 1,
    hint: 'N_s = 120 × f ÷ P, with f in hertz and P the number of poles.',
    explain: 'N_s = 120 × 60 ÷ 4 = 1800 rpm. The rotor of an induction motor turns a little slower, so a 4-pole 60 Hz motor typically runs at about 1750 rpm under load.',
    review: 'overview',
  },
  {
    id: 'slip',
    topic: 'speed',
    level: 'Intermediate',
    type: 'numeric',
    prompt: 'A 6-pole motor on a 50 Hz supply turns at 960 rpm. What is its slip, as a percentage?',
    unit: '%',
    answer: 4,
    tolerance: 0.1,
    hint: 'Find the synchronous speed first, then use s = (N_s − N_r) ÷ N_s.',
    explain: 'N_s = 120 × 50 ÷ 6 = 1000 rpm, so s = (1000 − 960) ÷ 1000 = 0.04, which is 4 %.',
    review: 'overview',
  },
  {
    id: 'rotor-frequency',
    topic: 'speed',
    level: 'Advanced',
    type: 'numeric',
    prompt: 'The 4-pole, 60 Hz motor runs with 3 % slip. At what frequency do the rotor currents produced by the forward field alternate?',
    unit: 'Hz',
    answer: 1.8,
    tolerance: 0.05,
    hint: 'The rotor sees the forward field move past at N_s − N_r, which is a fraction s of synchronous speed.',
    explain:
      'f_{rotor} = s × f = 0.03 × 60 = 1.8 Hz. At standstill (s = 1) the rotor current has the full supply frequency, and it falls as the rotor speeds up. The backward field also induces currents, at (2 − s) × f, about 118 Hz here, which is one reason a single-phase motor is less efficient than a three-phase one.',
    review: 'overview',
  },

  // ---- Torque and current curves ----
  {
    id: 'switch-opens',
    topic: 'curves',
    level: 'Intermediate',
    type: 'single',
    prompt: 'On the torque–speed graph of a capacitor-start motor, what happens when the centrifugal switch opens?',
    options: [
      'The motor loses all its torque and coasts to a stop',
      'The torque drops to the main-winding-only curve; the motor keeps running only if that curve is still above the load torque',
      'The torque jumps up, because the capacitor is no longer in the way',
      'Nothing changes, because the auxiliary winding no longer matters once the rotor turns',
    ],
    correct: 1,
    hint: 'Compare the solid and dashed curves in the Physics lab at the switch speed.',
    explain:
      'Above the switch speed only the main winding drives the rotor, and its curve is lower than the curve with the start circuit at that speed, so the torque drops. The motor settles where the main-winding curve meets the load line. If that curve lies below the load, the speed falls, the switch closes again and the motor cycles (Experiment 5).',
    review: 'lab',
  },
  {
    id: 'voltage-torque',
    topic: 'curves',
    level: 'Intermediate',
    type: 'numeric',
    prompt: 'The supply voltage falls from 120 V to 96 V. Torque is proportional to the square of the voltage. What percentage of its original starting torque does the motor now produce?',
    unit: '%',
    answer: 64,
    tolerance: 1,
    hint: '96 ÷ 120 = 0.8. The torque follows the square of that ratio.',
    explain: '0.8² = 0.64, so the motor gives 64 %: a 20 % sag costs 36 % of the torque. The breakdown torque falls by the same factor, so a loaded motor can run out of margin (Experiment 5).',
    review: 'lab',
  },

  // ---- Faults and protection ----
  {
    id: 'open-capacitor',
    topic: 'faults',
    level: 'Intermediate',
    type: 'single',
    prompt: 'A capacitor-start motor hums and will not turn from rest, but it keeps running if the shaft is spun by hand. The start capacitor tests open. Why does it behave this way?',
    options: [
      'With no capacitor the start winding carries almost no current, so the main winding alone gives no starting torque; once the rotor is spinning, the main winding can keep it going',
      'The main winding burns out whenever the capacitor opens',
      'The centrifugal switch only closes if the capacitor is intact',
      'An open capacitor reverses the field, so the rotor is pushed both ways at once',
    ],
    correct: 0,
    hint: 'Without the capacitor, which windings are carrying current at standstill?',
    explain:
      'The start winding is then open from the supply’s point of view, so only the main winding is energised: a pulsating field with zero net torque at rest. A spin gives the rotor a direction, and the forward field then dominates (Experiment 1). The same symptom comes from an open start winding or a stuck-open switch.',
    review: 'faults',
  },
  {
    id: 'switch-stuck-closed',
    topic: 'faults',
    level: 'Intermediate',
    type: 'single',
    prompt: 'The centrifugal switch of a capacitor-start motor has welded closed. What is the most likely result?',
    options: [
      'The motor cannot start at all',
      'The motor runs faster than synchronous speed',
      'The motor starts and runs, then the start winding and capacitor overheat because they carry current continuously',
      'The motor runs normally, because the start circuit is harmless once the motor is up to speed',
    ],
    correct: 2,
    hint: 'What happens to a part sized for seconds of use when it carries current for hours?',
    explain:
      'The motor starts normally, which hides the fault. The start winding is fine wire and the capacitor is an intermittent-duty type, so left in circuit they overheat, and the supply current is several times the normal running current (Experiment 7). The capacitor may bulge or vent, and the start winding burns open.',
    review: 'faults',
  },
  {
    id: 'shorted-turns',
    topic: 'faults',
    level: 'Advanced',
    type: 'multi',
    prompt: 'Which statements about shorted turns in a stator winding are true? Select all that apply.',
    options: [
      'A large current circulates in the shorted loop and heats those few turns very quickly',
      'The line current may rise only slightly, so an ordinary breaker or fuse may not notice the fault',
      'The motor’s torque stays the same, since only a few turns are involved',
      'The fault can grow until the coil burns open or shorts to the core',
    ],
    correct: [0, 1, 3],
    hint: 'Picture the shorted turns as the secondary of a transformer with almost no resistance.',
    explain:
      'The shorted turns form a closed loop around the same flux, so a very large current flows in it, and because so little copper is involved it heats in seconds. The supply current changes little, so breakers, fuses and average-temperature protectors often miss it. The healthy turns make less flux, so the torque falls, and the damage spreads until the coil opens or shorts to the core.',
    review: 'faults',
  },
];
