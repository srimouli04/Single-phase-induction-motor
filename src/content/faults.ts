// Fault scenarios: what each failure is, how it works, how the motor is damaged, how to recognise and prevent it.
// The numbers come from simulations/faults.ts at run time; the text here is deliberately qualitative so that it never
// contradicts the model when the student moves a slider.
import type { PartId } from '../scenes/layout';
import type { FaultId } from '../simulations/faults';

export type FaultGroupId = 'short' | 'start' | 'mechanical' | 'supply';

export interface FaultStage {
  when: string;
  what: string;
}

export interface FaultScenario {
  id: FaultId;
  title: string;
  /** Short name for the picker. */
  short: string;
  group: FaultGroupId;
  /** Component highlighted in the location diagram (also the Explorer link target). */
  part: PartId;
  /** What the severity slider means; absent when the scenario has no slider. */
  severityLabel?: string;
  lead: string;
  cause: string;
  how: string[];
  progression: FaultStage[];
  symptoms: string[];
  checks: string[];
  protection: string;
  lookFor: string;
  note?: string;
  /** True when the Physics lab can reproduce the scenario exactly with its own inputs. */
  inLab: boolean;
}

export const FAULT_GROUPS: { id: FaultGroupId; label: string; blurb: string }[] = [
  { id: 'short', label: 'Short circuits in the stator', blurb: 'Turns, laminations or a winding touching the frame.' },
  { id: 'start', label: 'Start circuit and open circuits', blurb: 'Capacitor, start winding, switch and main winding.' },
  { id: 'mechanical', label: 'Rotor, bearings and jams', blurb: 'Things that stop or slow the shaft.' },
  { id: 'supply', label: 'Supply, load and cooling', blurb: 'Nothing is broken inside, but the conditions are wrong.' },
];

export const SAFETY_TITLE = 'Safety: this is a simulation, not a procedure';
export const SAFETY_TEXT =
  'Never short, bypass or defeat protection on a real motor to “see what happens”. Real faults cause fire, electric shock, bursting capacitors and flying parts. Before anyone inspects a motor it must be isolated, locked out and proven dead, and capacitors must be discharged. Insulation, capacitance and resistance tests are for trained people using rated instruments.';

const SAME_SYMPTOM =
  'The simulator gives identical numbers for an open capacitor, an open start winding and a stuck-open switch: from the main winding’s point of view all three mean “no current in the start winding at standstill”. Only measurements on the stopped, isolated motor tell them apart.';

export const FAULTS: FaultScenario[] = [
  {
    id: 'turn-short',
    title: 'Shorted turns in the winding',
    short: 'Shorted turns',
    group: 'short',
    part: 'mainWinding',
    severityLabel: 'How many turns are shorted',
    lead: 'The enamel between neighbouring turns breaks down and a few turns are bypassed.',
    cause:
      'Overheating, voltage spikes, moisture, vibration rubbing the enamel, or a wire pinched during manufacture or rewinding breaks the thin insulation between neighbouring turns.',
    how: [
      'The bypassed turns now form a closed loop around the same magnetic flux as the rest of the winding, like the shorted secondary of a transformer. The flux induces a voltage in that loop, and because the loop has almost no resistance, a very large current circulates in it: many times the rated current of the motor.',
      'The supply current rises only a little, because the circulating current is reflected back to the line scaled by the small share of turns involved. The line current therefore hardly reveals the fault. But the heat I²R is produced in just a few turns, a tiny mass of copper, so those turns heat up in seconds.',
      'The healthy turns now produce less magnetic force, so the torque falls and the motor draws more current for the same load.',
    ],
    progression: [
      { when: 'First seconds', what: 'A large current circulates in the shorted loop and the turns heat at tens of degrees per second.' },
      { when: 'Within about a minute', what: 'Enamel on the shorted turns and their neighbours chars. The short grows: more turns are bypassed and the loop heats even faster.' },
      { when: 'Minutes', what: 'The coil burns through: smoke, varnish smell, a discoloured winding and a large loss of torque.' },
      { when: 'End', what: 'The coil burns open (the motor is dead) or shorts to the core (a ground fault) and the breaker finally trips.' },
    ],
    symptoms: ['Less torque, lower speed under load, more noise or vibration', 'Burning smell or smoke', 'One winding hotter than the other, or repeated protector trips', 'Winding resistance a few percent lower than the specification or a twin motor'],
    checks: [
      'Isolate and lock out first.',
      'Compare winding resistances with the specification. A few percent drop is the clue, and an ordinary multimeter can miss small ones.',
      'A surge (impulse) test or a growler test finds shorted turns that a resistance check misses.',
      'A thermal camera shows a hot patch if the motor can be run briefly and safely.',
    ],
    protection:
      'Ordinary breakers and fuses do not see it, because the line current barely changes. A thermal protector that senses the average winding temperature reacts far too slowly to a small hot spot. Prevention is cooling, clean and dry operation and avoiding voltage spikes; planned surge testing finds weakening insulation before it fails.',
    lookFor:
      'In the temperature chart the hot-spot curve leaves the winding curve within seconds and reaches the destruction line while the average winding temperature still looks normal.',
    inLab: false,
  },
  {
    id: 'core-short',
    title: 'Shorted stator core laminations',
    short: 'Shorted core',
    group: 'short',
    part: 'stator',
    severityLabel: 'How much of the core is bridged',
    lead: 'Insulation between the steel laminations is damaged, so eddy currents flow across them and heat the core.',
    cause:
      'A rotor that rubs the bore (worn bearings), a burr from machining, a mechanical blow, arcing from a winding fault, or burning the old winding out too hot during a rewind can smear or strip the coating between laminations and bridge them together.',
    how: [
      'The stator core is a stack of thin steel sheets, each coated with insulation, so that only tiny eddy-current loops can form. When several sheets are bridged, the loops can be much larger. Eddy loss grows roughly with the square of the loop size, so the bridged region loses many times more power than healthy core steel (about 20 times in this model).',
      'The heat appears inside the core, in one place, and spreads to the slot insulation and the winding beside it. The motor’s current hardly changes, because the extra loss is small compared with the motor’s total power.',
      'This is not a winding touching the core. That is a ground fault, which is the next scenario.',
    ],
    progression: [
      { when: 'At first', what: 'Extra iron loss of tens of watts in a small region. Nothing is visible from outside.' },
      { when: 'Weeks to months', what: 'The hot spot discolours the steel and darkens the varnish. Insulation near it ages about twice as fast for every 10 K it runs hotter.' },
      { when: 'Later', what: 'Heat damages the slot liner and the enamel next to the hot spot. A turn-to-turn short or a winding-to-core fault develops, and the failure then moves quickly.' },
    ],
    symptoms: ['Motor runs hotter than an identical healthy motor', 'Slightly higher no-load current and iron loss', 'Local discoloration or smeared metal in the bore', 'Repeated winding failures soon after a rewind'],
    checks: [
      'Isolate and lock out first.',
      'Look at the bore for rub marks and for smeared or fused laminations.',
      'Compare the no-load input power with a healthy motor of the same type.',
      'Large machines use a low-flux “loop” test with a thermal camera, or a core-imperfection tester. Small motors are usually replaced or rewound.',
    ],
    protection:
      'Nothing electrical sees it: current and temperature protection stay quiet because the heat is local and small. Prevention is replacing worn bearings early so the rotor never touches the stator, keeping to the repair guideline for burn-off temperature (about 370 °C) when rewinding, and checking core loss after repairs.',
    lookFor: 'The supply current barely moves, but the core temperature rises and the estimated insulation life drops by a large factor.',
    note: 'Real core faults are usually much smaller and hotter than this model, which spreads the extra loss over the share of core length you choose.',
    inLab: false,
  },
  {
    id: 'ground-fault',
    title: 'Winding shorted to the core or frame (ground fault)',
    short: 'Winding to frame',
    group: 'short',
    part: 'mainWinding',
    severityLabel: 'How hard the short is',
    lead: 'Insulation between a winding and the grounded steel fails, creating a path to the frame.',
    cause: 'Slot liner or enamel damaged by heat, vibration, moisture or contamination; a lead pinched or rubbing in the terminal box; water entering the motor.',
    how: [
      'A conductor now touches the steel core or frame, which is connected to protective earth. Current flows from the line, through part of the winding, through the fault into the frame and back to the supply through the earth conductor. Its size depends on the fault resistance: milliamps for damp insulation, hundreds of amps for a hard short.',
      'At the fault the current flows through carbonised insulation or an arc, and the power there (I²R_f) melts copper and chars material in a tiny spot.',
      'The metal frame is now connected to the supply through the fault. With a good protective earth the large current opens the breaker. Without an earth, the frame can sit near line voltage, and anyone touching it completes the circuit: that is the shock hazard.',
    ],
    progression: [
      { when: 'Early (leakage)', what: 'Damp or contaminated insulation leaks milliamps. The motor runs normally; only an insulation test or a residual-current device notices.' },
      { when: 'Tracking', what: 'Leakage chars the surface and forms a conductive track, and the current grows.' },
      { when: 'Breakdown', what: 'An arc forms at the fault. Copper melts and the insulation burns in a fraction of a second.' },
      { when: 'End', what: 'The breaker or the RCD trips. If neither does, fire or a live frame follows.' },
    ],
    symptoms: ['Breaker or RCD trips when the motor starts, or in damp weather', 'Tingling or shocks when touching the frame (dangerous: stop immediately)', 'Low insulation resistance between winding and frame', 'Burnt smell or scorch marks near the terminal box or slots'],
    checks: [
      'Isolate, lock out and prove the supply dead first.',
      'A qualified person measures the insulation resistance from winding to frame with a megohmmeter.',
      'Inspect the terminal box for pinched leads, water and tracking.',
    ],
    protection:
      'A protective earth on the frame and a 30 mA residual-current device (RCD) are the protection. A breaker alone reacts only to a hard fault: a moderate-resistance fault can carry ten amps or more, long enough to destroy the motor, without ever tripping a 15 A breaker. An RCD responds to far smaller leaks.',
    lookFor:
      'Drag the slider: a high-resistance leak stays below 30 mA (the RCD would stay quiet and nothing is destroyed). Lower the resistance and the fault spot reaches the destruction temperature within seconds. The 15 A breaker only trips when the fault is nearly a bolted short.',
    inLab: false,
  },
  {
    id: 'cap-open',
    title: 'Open start capacitor',
    short: 'Open capacitor',
    group: 'start',
    part: 'capacitor',
    lead: 'The capacitor no longer passes current, so the start winding gets no phase shift.',
    cause:
      'Start capacitors are electrolytic and rated for brief duty: a few seconds per start and a limited number of starts per hour. Heat, long or frequent starts, over-voltage or age dry out the electrolyte or open an internal fuse, and vibration can break a connection.',
    how: [
      'Without the capacitor no current flows in the auxiliary winding, so only the main winding is working. It makes a pulsating field whose forward and backward parts are equal. At standstill they cancel, so the starting torque is zero.',
      'The motor hums and draws the locked-rotor current of the main winding alone. Everything it takes from the supply becomes heat in the windings and the rotor.',
      'Give the shaft a push (Physics lab: “Initial speed”) and a single-winding motor will accelerate in whichever direction it was pushed. A “dead” motor that runs when pushed points to the start circuit.',
    ],
    progression: [
      { when: 'Every start attempt', what: 'The motor hums at about four times its running current and the winding heats steadily.' },
      { when: 'Tens of seconds to minutes', what: 'The thermal protector opens. The winding cools, the protector closes again, and the motor cycles on and off.' },
      { when: 'Each cycle', what: 'Adds thermal ageing to the insulation. Without a protector the main winding burns out within a few minutes.' },
    ],
    symptoms: ['Humming, no rotation', 'Starts if pushed by hand', 'Protector clicking on and off', 'Motor hot to the touch while the breaker does not trip'],
    checks: [
      'Isolate and lock out. Discharge the capacitor through a resistor first: it can keep a dangerous charge.',
      'Measure the capacitance with a capacitance meter and compare it with the label.',
      'Look for a bulged, leaking or vented case.',
    ],
    protection: 'The winding thermal protector saves the motor; the 15 A breaker does not trip at this current. Replace the capacitor with one of the same capacitance and voltage rating.',
    lookFor: 'The speed stays at zero, the temperature climbs until the protector opens at the trip line, then the motor cools and tries again.',
    note: SAME_SYMPTOM,
    inLab: true,
  },
  {
    id: 'cap-weak',
    title: 'Weak (degraded) start capacitor',
    short: 'Weak capacitor',
    group: 'start',
    part: 'capacitor',
    severityLabel: 'How degraded the capacitor is',
    lead: 'Capacitance has fallen well below its label value, so the start winding gets less phase shift and current.',
    cause: 'Gradual loss of electrolyte from heat, age and repeated starts lowers the capacitance and raises the capacitor’s internal resistance.',
    how: [
      'The capacitor sets how far the auxiliary current leads the main current, and how large it is. Less capacitance means a weaker, less helpful auxiliary current, so the rotating field at standstill is weaker and more elliptical.',
      'The starting torque falls roughly with the strength of the auxiliary field. A light load still starts; a heavy one may not. Once the motor is up to speed the start circuit is cut out, so the running performance is unchanged.',
    ],
    progression: [
      { when: 'Early', what: 'Starts get slower and the lights dim for longer. There is no other sign.' },
      { when: 'Later', what: 'A heavy load fails to start: the motor hums at locked-rotor current until the protector trips.' },
      { when: 'Finally', what: 'The capacitor opens, or overheats and vents, which gives the open-capacitor case.' },
    ],
    symptoms: ['Longer start-up time', 'Hard starting under load, then humming', 'Warm capacitor case after starting', 'Motor starts only after a push'],
    checks: ['Isolate and lock out, then discharge the capacitor.', 'Measure the capacitance and compare it with the label.', 'Check for bulging or oil leaks.'],
    protection: 'Nothing flags a slowly weakening capacitor. Periodic capacitance checks and replacement at the first sign of hard starting are the remedy.',
    lookFor: 'In the start-up chart the faulted speed curve rises more slowly. Compare the starting torque row of the table with the load torque.',
    inLab: true,
  },
  {
    id: 'aux-open',
    title: 'Open start (auxiliary) winding',
    short: 'Open start winding',
    group: 'start',
    part: 'auxWinding',
    lead: 'The start winding or its lead is broken, so the second phase never appears.',
    cause:
      'The fine start winding is sized for a few seconds of use per start. Long or repeated starts, or a switch that stays closed, burn it open. A lead can also break at the switch or at a terminal.',
    how: [
      'With the start winding open there is no second phase, so the field at standstill is pulsating and the starting torque is zero, exactly as with an open capacitor.',
      'If the motor is already running when this happens it keeps running, because a running motor does not need its start winding; it will not restart after it stops.',
    ],
    progression: [
      { when: 'Every start attempt', what: 'Humming at about four times the running current while the main winding heats.' },
      { when: 'Tens of seconds to minutes', what: 'The thermal protector opens and the motor cycles on and off.' },
      { when: 'Without a protector', what: 'The main winding burns out.' },
    ],
    symptoms: ['Humming, no rotation', 'Starts if pushed by hand', 'Protector cycling', 'Worked yesterday, will not restart today'],
    checks: ['Isolate and lock out. Disconnect the start winding from the capacitor and switch.', 'Measure its resistance: an open winding reads infinity, a healthy one reads several ohms, usually more than the main winding.'],
    protection: 'The winding thermal protector. Find out why the start winding burned (a stuck switch or a weak capacitor often cause long starts) before replacing the motor, or it will happen again.',
    lookFor: 'The numbers are the same as for the open capacitor.',
    note: SAME_SYMPTOM,
    inLab: true,
  },
  {
    id: 'switch-open',
    title: 'Centrifugal switch stuck open',
    short: 'Switch stuck open',
    group: 'start',
    part: 'centrifugalSwitch',
    lead: 'The switch contacts do not close when the motor is stopped, so the start circuit is never connected.',
    cause: 'Dirty, oxidised or pitted contacts, a weak or broken spring, or weights that bind keep the contacts from closing at standstill.',
    how: [
      'The centrifugal switch normally closes when the rotor is stopped and opens at about three quarters of synchronous speed. Stuck open, it leaves the start winding and capacitor disconnected, so the motor starts like an open start circuit: it hums and does not turn.',
      'Only motors that use a switch (split-phase and capacitor-start) are affected. Permanent-capacitor and shaded-pole motors have no switch, and some capacitor-start motors use a relay or an electronic switch instead.',
    ],
    progression: [
      { when: 'Every start attempt', what: 'Humming at about four times the running current.' },
      { when: 'Tens of seconds to minutes', what: 'The protector opens and the motor cycles.' },
      { when: 'Over time', what: 'Heat cycling ages the main winding’s insulation.' },
    ],
    symptoms: ['Humming, no rotation', 'Starts if pushed', 'Click from the end shield area when the shaft is turned by hand'],
    checks: ['Isolate and lock out, then discharge the capacitor.', 'With the end shield off, check that the weights move freely and the contacts close when the rotor is stopped.', 'Check contact resistance with a meter.'],
    protection: 'The winding thermal protector. Clean or replace the switch assembly; do not bridge the contacts permanently.',
    lookFor: 'The numbers are the same as for the open capacitor.',
    note: SAME_SYMPTOM,
    inLab: true,
  },
  {
    id: 'switch-closed',
    title: 'Centrifugal switch stuck closed (welded)',
    short: 'Switch stuck closed',
    group: 'start',
    part: 'centrifugalSwitch',
    lead: 'The start circuit never disconnects, so the start winding and capacitor stay in circuit while running.',
    cause: 'Contacts welded by arcing (too many starts per hour, a wrong capacitor), burrs or dirt jamming the weights, or a broken spring.',
    how: [
      'The motor starts normally and reaches full speed, which hides the fault at first.',
      'The start winding is made of fine wire sized for seconds of use, and the start capacitor is an intermittent-duty electrolytic type. Left in circuit they carry several amps continuously, so hundreds of watts are released in a small winding and the capacitor also heats.',
      'The supply current is several times the normal running current.',
    ],
    progression: [
      { when: 'First seconds', what: 'The start winding heats at several degrees per second.' },
      { when: 'About half a minute', what: 'In this model the start winding reaches the destruction temperature: the enamel chars and the winding burns open or shorts.' },
      { when: 'Meanwhile', what: 'The electrolytic capacitor overheats, bulges or vents, and some burst with a bang and spray electrolyte.' },
      { when: 'Afterwards', what: 'With the start winding gone the motor keeps running until it is stopped, then will not restart.' },
    ],
    symptoms: ['Running current far higher than normal', 'Hot, smelly or smoking start capacitor or winding', 'Capacitor bulged or vented', 'Motor runs, then will not start next time'],
    checks: ['Isolate, lock out and discharge the capacitor first.', 'Look for burnt or welded contacts and check that the switch moves freely and opens when the shaft is spun by hand.'],
    protection:
      'The simulator’s winding-temperature protector only senses the average winding temperature, which stays low, so it does not trip before the start winding is destroyed. Real motors may add a current-sensing protector that opens sooner.',
    lookFor: 'The hot-spot line (the start winding) shoots to the destruction limit while the average winding line stays cool.',
    inLab: true,
  },
  {
    id: 'main-open',
    title: 'Open main (run) winding',
    short: 'Open main winding',
    group: 'start',
    part: 'mainWinding',
    lead: 'The main winding or its connection is broken, so only the start winding is energised.',
    cause: 'A winding burnt open by an earlier short or overload, a broken lead at a terminal, or the motor’s own protector contacts failing open.',
    how: [
      'A single winding makes only a pulsating field, so with only the start winding (and its capacitor) connected there is no starting torque and no useful running torque.',
      'The start winding is not built for continuous duty. If the protector contacts are the open part, the motor is silent. If the main winding itself is open while the start circuit is still connected, the motor hums and the start winding overheats much faster than the average winding temperature suggests.',
    ],
    progression: [
      { when: 'Immediately', what: 'No rotation. The start winding carries current and the capacitor works hard.' },
      { when: 'Tens of seconds', what: 'The start winding passes its insulation rating while the average winding temperature is still low.' },
      { when: 'Minutes', what: 'The protector may open. The start winding or the capacitor can fail first.' },
    ],
    symptoms: ['Silence or humming, no rotation', 'Hot capacitor and start winding', 'Protector cycling or the motor completely dead'],
    checks: ['Isolate and lock out.', 'Check the continuity of the main winding and of the protector separately.'],
    protection: 'The winding thermal protector, if it can sense the start winding in time. Replace or rewind; check why the main winding opened.',
    lookFor: 'The speed stays at zero and the hot spot (start winding) leads the average winding temperature.',
    inLab: false,
  },
  {
    id: 'broken-bars',
    title: 'Broken rotor bars',
    short: 'Broken rotor bars',
    group: 'mechanical',
    part: 'rotor',
    severityLabel: 'How many bars are broken',
    lead: 'Cracks in the squirrel cage stop current flowing in some bars.',
    cause: 'Casting porosity, thermal stress from long or frequent starts, repeated high-inertia starts, or fatigue.',
    how: [
      'The rotor current flows through the bars and back through the end rings. A broken bar cannot carry current, so the neighbouring bars carry more. The cage as a whole has a higher resistance, and the current distribution around the rotor becomes uneven.',
      'Higher rotor resistance means more slip for the same torque, so the speed falls and rotor copper loss rises. The uneven current also produces a pulsing torque, which shows up as vibration, noise and a swinging speed.',
      'In this model broken bars only raise the rotor resistance; the pulsation and local hot spots at the break are not modelled.',
    ],
    progression: [
      { when: 'First', what: 'A small increase in slip and rotor heating. It is hard to notice.' },
      { when: 'Gradually', what: 'The bars next to the break overheat and crack, so the damage spreads.' },
      { when: 'Late', what: 'Broken pieces can lift and scrape the stator core, which can then produce a shorted-core fault. Speed and torque fall noticeably.' },
    ],
    symptoms: ['Speed slightly lower than before at the same load', 'Vibration, noise and a swinging speed', 'Rotor running hotter', 'Sidebands at twice the slip frequency in the stator current'],
    checks: ['Isolate and lock out.', 'Motor-current signature analysis finds broken bars while the motor runs under load.', 'A rotor “growler” test or a visual check of the cage on the removed rotor.'],
    protection: 'Nothing electrical protects against it. Limit starts per hour and starting time; use a motor with the right starting-duty rating for high-inertia loads.',
    lookFor: 'The running speed falls a little and the rotor loss rises. The starting torque can rise slightly because the rotor resistance is higher.',
    inLab: false,
  },
  {
    id: 'bearing-wear',
    title: 'Worn or failing bearings',
    short: 'Bearing wear',
    group: 'mechanical',
    part: 'bearings',
    severityLabel: 'How bad the bearing is',
    lead: 'Friction in the bearings rises and heat builds up at the end shield.',
    cause: 'Loss or contamination of grease, over-greasing, misalignment, belt over-tension, shaft currents and plain age.',
    how: [
      'Bearing friction is an extra mechanical load, so the motor slows down and draws more current. The friction power turns into heat concentrated in the bearing, which then conducts into the end shield, the shaft and the grease.',
      'As the clearance grows the heavy rotor sags toward the stator. Because the air gap is small, even slight sag can make the rotor rub the stator bore, which can smear and short the laminations. When the bearing finally seizes, the rotor stops and the motor is in the locked-rotor condition.',
    ],
    progression: [
      { when: 'First', what: 'A rumbling or squealing noise and slightly more current.' },
      { when: 'Hours to days', what: 'The bearing runs well above its grease rating and the grease breaks down, so friction rises further.' },
      { when: 'Later', what: 'The rotor rubs the stator and damages the laminations and slot insulation.' },
      { when: 'End', what: 'The bearing seizes and the motor stalls: locked rotor.' },
    ],
    symptoms: ['Grinding, rumbling or squealing noise', 'Hot end shield', 'Higher current and slightly lower speed', 'Shaft play or shaft that feels rough when turned by hand'],
    checks: ['Isolate and lock out.', 'Turn the shaft by hand and listen and feel for roughness.', 'Check for play by trying to lift the shaft.', 'Vibration analysis or a thermal camera on the end shields.'],
    protection: 'Regular lubrication to the maker’s schedule, aligned couplings, and replacing bearings at the first noise. The electrical protection reacts only once the motor is already in trouble.',
    lookFor: 'The bearing hot spot rises above its grease rating long before the winding looks hot.',
    inLab: false,
  },
  {
    id: 'locked-rotor',
    title: 'Locked (jammed) rotor',
    short: 'Locked rotor',
    group: 'mechanical',
    part: 'shaft',
    lead: 'The shaft cannot turn: a seized bearing, a jammed load or a rubbing rotor.',
    cause: 'A seized bearing, a jammed pump or compressor, a foreign object, a bent shaft or a rotor rubbing the stator.',
    how: [
      'A turning rotor cuts the stator field and generates a voltage that opposes the supply (the speed voltage), which limits the current. At standstill there is none of it, so only the leakage impedance of the windings limits the current: the locked-rotor current, typically four to six times the running current.',
      'None of the electrical power becomes mechanical power. Every watt becomes heat in the windings and the rotor bars, and the windings, with little thermal mass, heat in seconds.',
      'The breaker rating is above the locked-rotor current of a small motor, so it reacts only after minutes. The motor’s own thermal protector is what saves it.',
    ],
    progression: [
      { when: 'Immediately', what: 'The current jumps to the locked-rotor value and the motor hums.' },
      { when: 'Tens of seconds', what: 'The winding passes its insulation rating. With a start winding still connected it heats even faster.' },
      { when: 'Protector trips', what: 'The motor cools and the protector resets, so a motor that is still jammed cycles on and off, ageing the insulation each time.' },
      { when: 'No protector', what: 'The insulation chars and the winding burns out.' },
    ],
    symptoms: ['Humming, no rotation', 'Very high current', 'Protector tripping again and again', 'Hot motor, smell of varnish'],
    checks: ['Isolate and lock out.', 'Try to turn the shaft by hand. If it will not turn, find the jam or the seized bearing before restarting.'],
    protection: 'The thermal protector acts first. A breaker only trips after many minutes at this current. Do not keep resetting a protector that has tripped: find the cause.',
    lookFor: 'The current is flat at the locked-rotor value and the protector opens within about a minute.',
    inLab: true,
  },
  {
    id: 'low-voltage',
    title: 'Low supply voltage',
    short: 'Low voltage',
    group: 'supply',
    part: 'terminalBox',
    severityLabel: 'How low the voltage sags',
    lead: 'The supply is lower than the nameplate voltage, because of a long cable, a sagging supply or a loose connection.',
    cause: 'Undersized or very long wiring, a heavily loaded supply, or a loose or corroded terminal that drops voltage.',
    how: [
      'The torque of an induction motor is proportional to the square of the voltage. At 80 % of the voltage the torque is only 64 %, so the motor may fail to start a load that it normally handles, and it runs at a higher slip.',
      'At light load the current changes little, because the magnetising current falls with the voltage. As the load gets heavier, the current has to rise to deliver the same torque, so a heavily loaded motor on a weak supply runs hot.',
    ],
    progression: [
      { when: 'At start', what: 'Less starting torque, so slow starts or no start with a heavy load.' },
      { when: 'Running', what: 'Higher slip and, on a heavy load, more current and more heat.' },
      { when: 'Over months', what: 'Extra heating ages the insulation. A loose terminal also gets hot itself.' },
    ],
    symptoms: ['Slow or failed starts', 'Dimming lights when the motor starts', 'Motor warmer than usual', 'Hot terminal or cable'],
    checks: ['Measure the voltage at the motor terminals while the motor is starting, not only with it idle.', 'Check terminal tightness (isolated and locked out).'],
    protection: 'Correct cable size and tight connections. A thermal protector or overload relay responds to the extra heat, but not to the cause.',
    lookFor: 'Compare the starting torque with the healthy motor: the ratio is close to the voltage ratio squared.',
    inLab: true,
  },
  {
    id: 'overload',
    title: 'Overload (too much mechanical load)',
    short: 'Overload',
    group: 'supply',
    part: 'shaft',
    severityLabel: 'How much extra load',
    lead: 'The driven machine asks for more torque than the motor was sized for.',
    cause: 'A blocked filter or duct, a partly jammed pump or fan, a worn driven bearing, tight belts or a larger load than the motor was chosen for.',
    how: [
      'The motor slows until the torque it develops equals the load, so the slip rises. The rotor and stator currents rise with the load and the copper losses rise with their square, so the winding gets much hotter.',
      'Insulation life roughly halves for every 10 K above its rating. Beyond the breakdown torque the motor can no longer carry the load, stalls and becomes a locked rotor.',
    ],
    progression: [
      { when: 'Running', what: 'Lower speed, higher current, higher temperature.' },
      { when: 'Many minutes', what: 'The winding reaches the protector trip temperature, the motor stops, cools and restarts, cycling for as long as the overload remains.' },
      { when: 'Over months', what: 'Each hot period ages the insulation.' },
    ],
    symptoms: ['Speed lower than normal', 'Current above the nameplate value', 'Motor hot to the touch', 'Protector trips after some time'],
    checks: ['Measure the running current and compare it with the nameplate.', 'Check the driven machine for blockage, friction and belt tension (isolated and locked out).'],
    protection: 'The thermal protector or an overload relay set to the nameplate current. It is slow by design, because motors can safely carry short overloads.',
    lookFor: 'The motor keeps running but the temperature creeps up until the protector trips, much more slowly than for a locked rotor.',
    inLab: true,
  },
  {
    id: 'blocked-cooling',
    title: 'Blocked cooling',
    short: 'Blocked cooling',
    group: 'supply',
    part: 'fanCover',
    severityLabel: 'How badly cooling is blocked',
    lead: 'Heat cannot leave the motor, so the same losses give a much higher temperature.',
    cause: 'Dust or lint clogging the fins or the fan cover, a broken fan, a motor boxed in without air, or a very hot environment.',
    how: [
      'Nothing electrical changes: the current, torque and speed are the same as for a healthy motor. But the heat has to reach the air through the frame, so a worse path to the air means a higher temperature for the same power loss.',
      'The temperature rise above the surroundings is roughly the loss times the thermal resistance to the air. Doubling that resistance doubles the temperature rise.',
    ],
    progression: [
      { when: 'Hours', what: 'The temperature slowly climbs to a higher plateau.' },
      { when: 'Around an hour', what: 'The winding reaches the protector trip temperature and the motor cycles.' },
      { when: 'Years of life lost', what: 'Insulation life roughly halves for every 10 K above its rating, so a motor that only runs 30 K too hot loses most of its life.' },
    ],
    symptoms: ['Motor too hot to touch although the current is normal', 'Protector trips after long running', 'Dust-clogged fins or fan cover'],
    checks: ['Look at the fins, fan cover and ventilation openings (isolated and locked out).', 'Compare the temperature with a similar healthy motor under the same load.'],
    protection: 'Keep the motor clean with a clear air path. The thermal protector eventually trips, but only after much of the insulation life is used up.',
    lookFor: 'The current and speed are identical to the healthy motor, but the steady temperature is much higher.',
    inLab: false,
  },
];

export const FAULT_BY_ID = Object.fromEntries(FAULTS.map((f) => [f.id, f])) as Record<FaultId, FaultScenario>;
export const isFaultId = (v: unknown): v is FaultId => typeof v === 'string' && v in FAULT_BY_ID;

/** Failures worth exploring for each component (used by the Explorer's "What if it fails?" buttons). */
export const FAULTS_FOR_PART: Record<PartId, FaultId[]> = {
  housing: ['blocked-cooling'],
  stator: ['core-short', 'ground-fault'],
  mainWinding: ['turn-short', 'main-open', 'ground-fault'],
  auxWinding: ['aux-open', 'switch-closed'],
  capacitor: ['cap-open', 'cap-weak'],
  rotor: ['broken-bars', 'locked-rotor'],
  shaft: ['locked-rotor', 'overload'],
  airGap: ['bearing-wear', 'core-short'],
  bearings: ['bearing-wear', 'locked-rotor'],
  endShields: ['bearing-wear'],
  fan: ['blocked-cooling'],
  fanCover: ['blocked-cooling'],
  terminalBox: ['ground-fault', 'low-voltage'],
  centrifugalSwitch: ['switch-open', 'switch-closed'],
};
