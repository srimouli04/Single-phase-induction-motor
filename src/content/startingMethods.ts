// Teaching content for the Starting methods section. Ranges are textbook rules of thumb ("typical, varies by design"),
// never mixed with the numbers the model computes.
import type { StartMethod } from '../simulations/motorModel';

export type MethodId = 'split-phase' | 'capacitor-start' | 'psc' | 'cscr' | 'shaded-pole';
export const METHOD_IDS: readonly MethodId[] = ['split-phase', 'capacitor-start', 'psc', 'cscr', 'shaded-pole'];
export const isMethodId = (v: unknown): v is MethodId => typeof v === 'string' && (METHOD_IDS as readonly string[]).includes(v);

export interface Typical {
  startTorque: string;
  startCurrent: string;
  powerFactor: string;
  cost: string;
  size: string;
  reversing: string;
}

export interface StartingMethod {
  id: MethodId;
  short: string;
  title: string;
  tagline: string;
  /** Method of the Physics lab that reproduces it (CSCR: none, it is the capacitor-start and PSC halves). */
  lab: StartMethod | null;
  /** True when a centrifugal switch (or relay) disconnects part of the start circuit. */
  switched: boolean;
  principle: string;
  sequence: string[];
  strengths: string[];
  limits: string[];
  uses: string[];
  typical: Typical;
  lookFor: string;
  note?: string;
}

export const STARTING_INTRO =
  'A single winding makes a pulsating field and no starting torque (Section 3). Every starting method does the same job: it adds a second field that is shifted in space (a second winding, or a ring on part of a pole) and in time (a phase lag or lead). Added together, the two fields give one that moves, at least partly, and the rotor can follow it. Once the rotor is turning, a single winding is enough to keep it turning.';

export const STARTING_METHODS: StartingMethod[] = [
  {
    id: 'split-phase',
    short: 'Split-phase',
    title: 'Split-phase (resistance-start) motor',
    tagline: 'A second winding with more resistance shifts its current by a small angle.',
    lab: 'split-phase',
    switched: true,
    principle:
      'The auxiliary winding is wound with fewer turns of thinner wire, so its resistance is high compared with its reactance. The main winding is the opposite: mostly inductive. The same voltage therefore drives two currents that are not in step: the main current lags the voltage by a large angle, the auxiliary current lags by a smaller one, so the auxiliary current leads the main current by roughly 20–30°. That is far from the ideal 90°, so the field is a thin ellipse. There is a starting torque, but only a modest one, and the line current is high. A centrifugal switch disconnects the auxiliary winding at about 75 % of synchronous speed.',
    sequence: [
      'Switch on at standstill. The centrifugal switch is closed, so both windings are connected across the supply.',
      'The main current lags the voltage a lot (inductive) and the auxiliary current lags it less (more resistive). The two currents differ by only about 20–30° in time.',
      'Two windings 90° apart in space with currents slightly out of step give an elliptical rotating field. The rotor follows its larger rotating part: a modest starting torque.',
      'At about 70–80 % of synchronous speed the flyweights open the switch and the auxiliary winding drops out. One winding is enough to keep a turning rotor turning.',
      'The motor settles where its torque equals the load torque, a little below synchronous speed.',
    ],
    strengths: ['No capacitor: simple and cheap.', 'Rugged. The only part that wears is the switch.'],
    limits: [
      'Low starting torque and a high starting current, so hard-to-start loads are out of reach.',
      'The thin auxiliary winding overheats within seconds if the switch fails to open.',
      'Cannot be started often: the start winding needs time to cool between starts.',
    ],
    uses: ['Fans and blowers', 'Centrifugal pumps', 'Older washing machines', 'Small grinders and machine tools'],
    typical: {
      startTorque: 'About 150–200 % of full-load torque',
      startCurrent: 'About 6–8 × full-load current',
      powerFactor: 'Moderate',
      cost: 'Low',
      size: 'Up to about 1/3 hp (250 W)',
      reversing: 'Swap the auxiliary (or main) winding leads, with the motor at rest',
    },
    lookFor: 'Switch the diagram to “Running”: the switch opens and the auxiliary current stops. At standstill, compare the angle between the two currents in the phasor picture with the ideal 90°.',
  },
  {
    id: 'capacitor-start',
    short: 'Capacitor-start',
    title: 'Capacitor-start motor',
    tagline: 'A series capacitor makes the auxiliary current lead, so the two currents are nearly 90° apart.',
    lab: 'capacitor-start',
    switched: true,
    principle:
      'A capacitor in series with the auxiliary winding makes that branch capacitive, so its current leads the voltage while the main current lags it. The two currents end up nearly 90° apart in time. With the windings 90° apart in space the field at standstill is almost circular, so the starting torque is large, much larger than a split-phase motor gives for a lower line current. The start capacitor is a compact electrolytic type of a few hundred µF, rated for short duty only, so the centrifugal switch must remove it as soon as the motor is up to speed.',
    sequence: [
      'Switch on at standstill. The switch is closed, so both windings are across the supply and the capacitor is in series with the auxiliary winding.',
      'The capacitor’s reactance X_C = 1/(2πfC) is larger than the winding’s own reactance, so the auxiliary current leads the voltage. With the main current lagging, the displacement comes close to 90°.',
      'A nearly circular rotating field gives a strong starting torque. In the Physics lab this is the large gap between the “with start circuit” curve and the main-winding curve.',
      'At about 75 % of synchronous speed the switch opens. The capacitor and auxiliary winding are disconnected, the torque curve drops to the main-winding curve and the line current falls.',
      'The motor settles close to synchronous speed, running on the main winding alone.',
    ],
    strengths: ['High starting torque for a modest starting current.', 'Simple, robust and very widely used.'],
    limits: [
      'Needs a capacitor and a switch, the two parts that fail most often.',
      'The start capacitor is short-duty: if the switch sticks closed it overheats and can burst.',
      'Running on the main winding alone gives only a moderate power factor.',
    ],
    uses: ['Air compressors', 'Pumps and conveyors', 'Small refrigeration and air-conditioning compressors', 'Machines that must start under load'],
    typical: {
      startTorque: 'About 250–400 % of full-load torque',
      startCurrent: 'About 3.5–5 × full-load current',
      powerFactor: 'Moderate once running (main winding alone)',
      cost: 'Moderate',
      size: 'About 1/8 hp up to 5–10 hp',
      reversing: 'Swap the auxiliary winding leads, with the motor at rest',
    },
    lookFor: 'In “Watch a start-up”, step through the instant the switch opens: the speed keeps rising, but the line current drops sharply as the capacitor leaves the circuit.',
  },
  {
    id: 'psc',
    short: 'PSC',
    title: 'Permanent split capacitor (PSC) motor',
    tagline: 'A smaller capacitor stays in circuit all the time: no switch, quiet running, weak start.',
    lab: 'psc',
    switched: false,
    principle:
      'A run capacitor (a long-life metallised-film type of a few to a few tens of µF) is permanently in series with the auxiliary winding, so both windings are always energised and there is no centrifugal switch. The capacitor is chosen for good running performance, a nearly circular field near the running speed, which gives smooth, quiet torque and a high power factor. It is not chosen for starting: a capacitor big enough for a strong start would draw too much current when running. At standstill the displacement between the currents is not ideal, so the starting torque is low and PSC motors suit loads that are easy to start, such as fans.',
    sequence: [
      'Switch on. Both windings are across the supply, the auxiliary one through the run capacitor. There is no switch.',
      'At standstill the capacitor is too small for an ideal displacement. The field is far from circular and the starting torque is low.',
      'As the rotor speeds up the field becomes more circular. The capacitor is sized for the running speed, where the displacement is close to 90°, and the torque rises.',
      'Nothing is disconnected. The capacitor and auxiliary winding stay in circuit while running, which improves the power factor and smooths the torque.',
      'The motor runs a little below synchronous speed. A fan load needs far less torque at lower speed, and motor torque falls with the square of the voltage, so lowering the voltage lowers the speed: a simple way to control a PSC fan.',
    ],
    strengths: ['No switch to wear out: reliable and quiet.', 'High running power factor and smooth torque.', 'Easy to reverse; speed can be varied by voltage control.'],
    limits: ['Low starting torque: unsuitable for compressors or loaded starts.', 'The capacitor value is a compromise between starting and running.'],
    uses: ['Fans and blowers', 'Small pumps', 'Gate and garage-door openers (they reverse often)', 'Speed-controlled appliances'],
    typical: {
      startTorque: 'Low: about 30–100 % of full-load torque',
      startCurrent: 'A few × full-load current, lower than split-phase',
      powerFactor: 'High (the capacitor stays in circuit)',
      cost: 'Moderate (a capacitor but no switch)',
      size: 'Mostly fractional hp, up to about 1–2 hp',
      reversing: 'Easy: swap which winding the capacitor feeds',
    },
    lookFor: 'Compare the standstill and running phasor pictures: the displacement angle changes with speed. Then raise the load in the comparison and watch the PSC motor stop starting first.',
  },
  {
    id: 'cscr',
    short: 'CSCR',
    title: 'Capacitor-start capacitor-run (CSCR) motor',
    tagline: 'Two capacitors: a big one for starting, a smaller one that stays for running.',
    lab: null,
    switched: true,
    principle:
      'Combines the two ideas. A large start capacitor is switched in parallel with a smaller run capacitor by a centrifugal switch (or a relay). At standstill the two add, so the motor starts like a capacitor-start motor. At about 75 % of synchronous speed the switch removes the start capacitor and the run capacitor alone remains, so the motor then runs like a PSC motor, with its better power factor and smoother torque. The price is two capacitors and a switch.',
    sequence: [
      'Switch on. The switch is closed, so the start and run capacitors are in parallel, C_{start} + C_{run}, in series with the auxiliary winding.',
      'The large total capacitance puts the two currents close to 90° apart, so the starting torque is strong, like a capacitor-start motor.',
      'At about 75 % of synchronous speed the switch opens and the start capacitor leaves. The auxiliary winding stays connected through the run capacitor.',
      'The motor now follows the PSC torque curve: better power factor and smoother torque than a capacitor-start motor running on one winding.',
    ],
    strengths: ['Strong starting torque and good running performance.', 'Lower running current than a capacitor-start motor of the same rating.'],
    limits: ['Most parts and the highest cost: two capacitors and a switch.', 'A failed start capacitor and a failed run capacitor each degrade the motor differently, which makes faults harder to spot.'],
    uses: ['Refrigeration and air-conditioning compressors', 'Larger pumps and blowers', 'Heavy single-phase machine drives'],
    typical: {
      startTorque: 'About 250–400 % of full-load torque',
      startCurrent: 'About 3.5–5 × full-load current',
      powerFactor: 'High when running',
      cost: 'Highest of the capacitor types',
      size: 'Typically about 1 hp up to 10 hp',
      reversing: 'Swap the auxiliary winding leads, with the motor at rest',
    },
    lookFor: 'Watch which capacitor stays when the switch opens. In the comparison chart the torque curve jumps at the switch speed, from the strong start curve to the PSC curve.',
    note: 'CSCR is analytical only in this app. The standstill point and both torque curves are computed, but the switch-over is not simulated, so there is no start-up animation or start / stall result for it.',
  },
  {
    id: 'shaded-pole',
    short: 'Shaded-pole',
    title: 'Shaded-pole motor',
    tagline: 'A shorted copper ring on part of each pole delays its flux and sweeps the field across the pole face.',
    lab: null,
    switched: false,
    principle:
      'A shaded-pole motor has salient poles with a single coil: no auxiliary winding, no capacitor and no switch. A slot cuts off roughly a third of each pole face and a closed copper ring (the shading coil) is fitted around that part. The changing flux induces a current in the ring which, by Lenz’s law, opposes the change, so the flux in the shaded part lags the flux in the unshaded part by a few tens of degrees. Two fluxes shifted in space and in time make a weak sweeping field that moves from the unshaded part towards the shaded part, and the rotor follows it. The starting torque is small, the losses in the ring make the motor inefficient, and the direction of rotation is fixed by the ring position.',
    sequence: [
      'The single coil carries alternating current and makes an alternating flux in the pole.',
      'The flux through the shaded part induces a current in the copper ring, which opposes the change of flux (Lenz’s law).',
      'So the flux in the shaded part lags the flux in the unshaded part: it peaks later in each cycle.',
      'The place where the flux is strongest moves from the unshaded part to the shaded part every cycle: a weak moving field whose direction is set by where the ring is.',
      'The squirrel-cage rotor is dragged along with this field. Once it is turning, the main flux keeps it turning.',
    ],
    strengths: ['The simplest and cheapest of all: no start winding, capacitor or switch.', 'Very few parts to fail; many designs tolerate a stalled rotor because their impedance is high.'],
    limits: ['Very low starting torque and low efficiency (losses in the ring).', 'Fixed direction of rotation.', 'Poor power factor; only small sizes are practical.'],
    uses: ['Small fans (bathroom, range hood, refrigerator)', 'Hair dryers', 'Turntables and small appliance motors', 'Small pumps and blowers'],
    typical: {
      startTorque: 'Low: roughly 25–50 % of full-load torque',
      startCurrent: 'Low: not much above the running current',
      powerFactor: 'Low',
      cost: 'Lowest',
      size: 'Tiny up to about 1/20 hp (40 W)',
      reversing: 'Not reversible (direction fixed by the ring)',
    },
    lookFor: 'Watch the two flux arrows: the shaded one always peaks after the unshaded one. The rotor turns toward the shaded part.',
    note: 'Illustration and qualitative explanation only: the equivalent-circuit model in the Physics lab has no shaded-pole option, so no torque or current numbers are computed for it.',
  },
];

export const METHOD_BY_ID = Object.fromEntries(STARTING_METHODS.map((m) => [m.id, m])) as Record<MethodId, StartingMethod>;

// ---------------------------------------------------------------- parts that can be clicked in the diagrams

export type PartKey = 'supply' | 'main' | 'aux' | 'switch' | 'startCap' | 'runCap' | 'auxR' | 'coil' | 'unshaded' | 'ring' | 'rotor';

export interface PartInfo {
  name: string;
  role: string;
  fails: string;
}

export const PART_INFO: Record<PartKey, PartInfo> = {
  supply: {
    name: 'Single-phase AC supply',
    role: 'One alternating voltage (120 V, 60 Hz in the example motor). Both windings are connected across it, so any phase shift between the two currents has to come from the motor itself: from resistance, from a capacitor, or from a shading ring.',
    fails: 'Low voltage cuts torque roughly with the square of the voltage and can leave the motor unable to start. See the fault simulator.',
  },
  main: {
    name: 'Main (running) winding',
    role: 'Thick wire, many turns, low resistance and high inductance. It is connected whenever the motor runs and carries most of the running current. Its current lags the voltage by a large angle.',
    fails: 'Open: no torque at all, the motor is dead. Shorted turns or a fault to the frame: high current, heat and a tripped protector.',
  },
  aux: {
    name: 'Auxiliary (starting) winding',
    role: 'Placed 90 electrical degrees from the main winding. Its current is shifted in time (by its resistance or by a capacitor) so that the two windings together make a rotating field.',
    fails: 'Open: the motor hums but does not start, although it may run if spun by hand. Left connected too long (stuck switch) in a start-type motor, its thin wire overheats and burns.',
  },
  switch: {
    name: 'Centrifugal switch',
    role: 'Closed at rest. Spring-loaded flyweights on the shaft open it at about 70–80 % of synchronous speed, disconnecting the start circuit. It re-closes when the motor slows well below that speed.',
    fails: 'Stuck open: no start, the motor hums. Stuck closed: the start circuit stays energised, so the winding or capacitor overheats and the running current is high.',
  },
  startCap: {
    name: 'Start capacitor',
    role: 'A large (typically a few hundred µF) electrolytic capacitor for short duty. Its reactance makes the auxiliary current lead the voltage, giving a displacement near 90° and a strong starting torque.',
    fails: 'Open or weak: low starting torque and a slow or failed start. Left in circuit by a stuck switch: it overheats and can burst. Discharge it before touching it.',
  },
  runCap: {
    name: 'Run capacitor',
    role: 'A smaller metallised-film capacitor rated for continuous duty, permanently in series with the auxiliary winding. It sets the displacement while running, improving power factor and smoothing the torque.',
    fails: 'Weak or open: the motor runs hotter, hums and loses torque. Because it is sized for running, a PSC motor is already weak at starting, so a bad run capacitor often stops it from starting at all.',
  },
  auxR: {
    name: 'Resistance of the auxiliary branch',
    role: 'In a split-phase motor the auxiliary winding is wound with thin wire, so its resistance is high compared with its reactance. This is the only thing that shifts its current. Here it is drawn as a separate resistor.',
    fails: 'The thin wire cannot carry current for long: if the switch does not open the winding overheats and burns within seconds.',
  },
  coil: {
    name: 'Coil (the only winding)',
    role: 'A single coil on the pole body. It carries alternating current and makes an alternating flux in the pole, with no phase shift of its own.',
    fails: 'Open: no field, motor dead. Shorted turns: heat and a weak field.',
  },
  unshaded: {
    name: 'Unshaded part of the pole',
    role: 'Carries the flux of the coil directly, so its flux follows the coil current without delay.',
    fails: 'Nothing special to fail; a cracked lamination or loose pole piece changes the flux path and the starting torque.',
  },
  ring: {
    name: 'Shading ring (shading coil)',
    role: 'A closed copper loop around about a third of the pole face. The flux through it induces a current that opposes the change of flux (Lenz’s law), so the flux in the shaded part lags the rest. This lag is what moves the field.',
    fails: 'A broken or missing ring: the field only pulsates, so the motor does not start. The ring also wastes power as heat, which is why these motors are inefficient.',
  },
  rotor: {
    name: 'Squirrel-cage rotor',
    role: 'Bars short-circuited by end rings. The moving field induces current in the bars, and these currents interact with the field to give torque, always dragging the rotor after the field.',
    fails: 'Broken bars cut torque and cause vibration and heating. A rubbing or seized rotor is a locked-rotor condition.',
  },
};
