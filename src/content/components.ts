import type { PartId } from '../scenes/layout';

export interface MotorComponent {
  id: PartId;
  name: string;
  /** One-line summary shown in lists and tooltips. */
  tagline: string;
  /** Hidden inside the housing when the motor is assembled. */
  internal: boolean;
  function: string;
  material: string;
  interactions: string;
  failure: string;
  /** Technical-accuracy note (alternative designs). */
  note?: string;
  /** Extra search words. */
  keywords: string;
}

export const MODEL_NOTE =
  'The 3D model shows ONE representative configuration: a 4-pole capacitor-start squirrel-cage motor with a centrifugal switch. Other single-phase motors differ: PSC and shaded-pole motors have no starting switch, some capacitor-start motors use a relay or electronic switch, and capacitor-run motors keep a run capacitor connected. Proportions and the air gap are exaggerated for visibility; the model is not to scale.';

export const COMPONENTS: MotorComponent[] = [
  {
    id: 'housing',
    name: 'Motor frame / housing',
    tagline: 'Supports the stator, protects the windings and sheds heat.',
    internal: false,
    function:
      'Holds the stator core in position, carries the end shields and mounting feet, protects the windings from knocks and contamination, and conducts heat from the stator core to the outside air. External cooling fins increase the surface area and the fan blows air over them.',
    material: 'Cast iron, drawn or rolled steel, or aluminium in lighter motors, usually with external fins and mounting feet or a flange.',
    interactions:
      'The stator core is pressed or keyed into the frame. End shields clamp onto its ends. The terminal box and capacitor mount on its outer surface, and the fan, cover and fins define the cooling-air path.',
    failure:
      'A cracked or corroded frame loosens the stator core and end shields (misalignment, rubbing, noise). Blocked fins or a failed fan raise winding temperature and shorten insulation life; the thermal protector may then trip the motor.',
    keywords: 'frame enclosure casing fins feet cooling body shell',
  },
  {
    id: 'stator',
    name: 'Stator core',
    tagline: 'Laminated steel ring that guides the magnetic flux.',
    internal: true,
    function:
      'Provides a low-reluctance path for the magnetic flux and slots that hold the windings. Flux produced by the windings crosses the air gap into the rotor and returns through the stator back-iron.',
    material: 'A stack of thin, insulated electrical-steel laminations (a few tenths of a millimetre each), riveted, welded or bonded together.',
    interactions: 'Fits inside the frame. The windings sit in its slots behind insulating slot liners. Its bore faces the rotor across the air gap.',
    failure:
      'Shorted laminations or damaged insulation increase eddy-current heating. A loose core vibrates and hums. Bore damage from the rotor rubbing disturbs the air gap and the flux pattern.',
    keywords: 'laminations steel core slots iron magnetic circuit',
  },
  {
    id: 'mainWinding',
    name: 'Main (running) winding',
    tagline: 'Connected across the supply while running; makes a pulsating field.',
    internal: true,
    function:
      'Connected across the supply whenever the motor runs. On its own it creates a pulsating magnetic field (a standing wave that reverses every half-cycle). That can sustain rotation once the rotor is turning but cannot start it. It carries most of the running current.',
    material: 'Enamelled copper (sometimes aluminium) magnet wire in the stator slots, insulated by slot liners and impregnated with varnish.',
    interactions:
      'Wound in the stator slots, displaced 90 electrical degrees from the auxiliary winding. Its leads go to the terminal box. The rotor bars link its flux and carry the induced current.',
    failure:
      'An open winding means no current and no torque. Shorted turns or a winding-to-core fault draw excess current, overheat, hum and may trip the thermal protector or the supply fuse.',
    keywords: 'run winding copper coil running stator winding',
  },
  {
    id: 'auxWinding',
    name: 'Auxiliary (starting) winding',
    tagline: 'Spatially displaced winding that makes a rotating field for starting.',
    internal: true,
    function:
      'Displaced about 90 electrical degrees from the main winding in space. Its current is shifted in time by its different impedance and, in capacitor motors, by the capacitor, so the two windings together create a rotating (or elliptical) field and therefore starting torque.',
    material: 'Enamelled copper wire. In start-type motors it is usually finer than the main winding because it carries current only briefly.',
    interactions:
      'Shares the stator slots with the main winding. It is connected in series with a capacitor and, in start-type motors, with the centrifugal (or other starting) switch. Its leads go to the terminal box.',
    failure:
      'An open auxiliary winding leaves the motor humming without starting; it may run if spun by hand, in either direction. If it stays energised too long in a start-type motor its thin wire overheats and burns.',
    keywords: 'start winding auxiliary phase split second winding',
  },
  {
    id: 'capacitor',
    name: 'Capacitor',
    tagline: 'Makes the auxiliary current lead, improving starting torque.',
    internal: false,
    function:
      'Placed in series with the auxiliary winding. Its capacitive reactance makes the auxiliary current lead the main current, increasing the phase displacement between the winding currents and therefore the starting torque for a given line current.',
    material: 'Start capacitors are usually non-polarised aluminium electrolytic types rated for short duty; run capacitors are metallised-film types rated for continuous duty. Both are housed in a plastic or metal can.',
    interactions:
      'Connected between the supply and the auxiliary winding, through the centrifugal switch in a capacitor-start motor. Mounted on the frame, with leads running to the terminal box.',
    failure:
      'An open, shorted or low-capacitance unit gives weak or no starting torque, humming, slow starts and overheating. A bulging or leaking case indicates failure. Capacitors can hold charge, so only a qualified person should handle them, after the motor is isolated and the capacitor discharged.',
    note: 'In a PSC motor the capacitor stays connected permanently as a run capacitor; in a capacitor-start motor it is a larger, short-duty start capacitor that is disconnected after starting.',
    keywords: 'start capacitor run capacitor microfarad uF can phase shift',
  },
  {
    id: 'rotor',
    name: 'Squirrel-cage rotor',
    tagline: 'Laminated core with shorted bars and end rings; energised by induction.',
    internal: true,
    function:
      'Carries the currents induced by the stator field. The bars and end rings form closed loops; the interaction between these induced currents and the air-gap flux produces torque that turns the shaft. There is no electrical connection to the rotor.',
    material: 'Laminated steel core with die-cast aluminium bars and end rings (copper in some larger or high-efficiency motors). Bars are often slightly skewed to reduce noise and cogging.',
    interactions: 'Pressed onto the shaft and turning inside the stator bore with the air gap between. The cooling fan and the centrifugal-switch collar are mounted on the same shaft.',
    failure:
      'Cracked or broken bars or end rings lower torque, raise slip and cause speed and current ripple, vibration and noise. A bent shaft or worn bearing lets the rotor rub on the stator.',
    keywords: 'bars end rings cage aluminium induced current armature',
  },
  {
    id: 'shaft',
    name: 'Shaft',
    tagline: 'Carries the rotor and delivers torque to the load.',
    internal: false,
    function: 'Carries the rotor and transmits the mechanical torque to the load (pulley, coupling or fan). It is supported by two bearings.',
    material: 'Machined carbon steel, with a keyway or flat at the drive end for the coupling.',
    interactions: 'The rotor is pressed on; bearings support it near each end; the fan and the centrifugal-switch collar are fitted to it; the drive-end extension passes through the end shield.',
    failure: 'A bent or worn shaft causes vibration, rubbing and bearing damage. A sheared key or slipping coupling loses torque transmission.',
    keywords: 'axle key keyway drive end rotor shaft',
  },
  {
    id: 'airGap',
    name: 'Air gap',
    tagline: 'Thin clearance between stator bore and rotor; the flux crosses it.',
    internal: true,
    function:
      'The small clearance between the stator bore and the rotor surface. The magnetic flux crosses it and torque is exerted across it. A small gap keeps the magnetising current low; too small a gap risks the rotor rubbing.',
    material: 'Not a part: it is air space, typically a fraction of a millimetre in small motors. It is drawn exaggerated and translucent here so it can be seen.',
    interactions: 'Bounded by the stator bore and the rotor surface. Its width and uniformity depend on rotor-stator concentricity, which the bearings and end shields set.',
    failure:
      'An uneven gap (worn bearings, bent shaft, loose end shield) causes unbalanced magnetic pull, noise, vibration and rubbing. A larger gap raises magnetising current and lowers power factor.',
    keywords: 'clearance gap flux reluctance concentricity',
  },
  {
    id: 'bearings',
    name: 'Bearings (drive end and non-drive end)',
    tagline: 'Support the shaft and keep friction low.',
    internal: false,
    function: 'Support the rotating shaft, keep the rotor centred in the stator bore and reduce friction.',
    material: 'Sealed, grease-lubricated steel ball bearings in most motors; sleeve (bushing) bearings in some small motors.',
    interactions: 'Seated in the hubs of the two end shields with the shaft turning in the inner race. They set the air-gap concentricity.',
    failure:
      'Worn, dry or contaminated bearings add friction torque, noise and heat and may eventually seize or let the rotor rub on the stator. Excess friction slows start-up and raises the current.',
    keywords: 'ball bearing race friction sleeve bush grease',
  },
  {
    id: 'endShields',
    name: 'End shields / end bells',
    tagline: 'End covers that hold the bearings and close the frame.',
    internal: false,
    function: 'Close the ends of the frame, hold the bearings and locate the rotor concentrically in the stator bore.',
    material: 'Cast iron or die-cast aluminium.',
    interactions: 'Clamped to the frame (often by through-bolts). Their hubs hold the bearings; the non-drive-end shield also carries the centrifugal-switch contacts; the fan cover fits outside it.',
    failure: 'A cracked or loose end shield lets the rotor sag or shift, giving an uneven air gap, bearing wear, noise and possible rubbing.',
    keywords: 'end bell endbell cover bracket flange',
  },
  {
    id: 'fan',
    name: 'Cooling fan',
    tagline: 'Blows air over the frame fins to remove heat.',
    internal: false,
    function: 'Pushes air over the frame\'s cooling fins to carry away the heat produced by electrical and mechanical losses.',
    material: 'Moulded plastic, aluminium or sheet-steel blades on a hub.',
    interactions: 'Mounted on the non-drive-end shaft extension inside the fan cover and rotating with the rotor.',
    failure: 'A broken or loose fan reduces cooling and the motor overheats. An unbalanced fan causes vibration and noise.',
    note: 'Some small motors (for example many shaded-pole fan motors) have no separate fan; they are cooled by the driven fan or the air stream.',
    keywords: 'blades impeller ventilation airflow',
  },
  {
    id: 'fanCover',
    name: 'Fan cover (shroud)',
    tagline: 'Guards the fan and directs air onto the fins.',
    internal: false,
    function: 'Protects people and the fan from contact and guides air from the intake grille towards the cooling fins.',
    material: 'Pressed sheet steel or cast aluminium with an air-intake grille.',
    interactions: 'Fixed to the non-drive-end shield or frame, surrounding the fan.',
    failure: 'A blocked or damaged grille restricts airflow and causes overheating. A dented cover can rub against the fan.',
    keywords: 'shroud guard grille cowl',
  },
  {
    id: 'terminalBox',
    name: 'Terminal box',
    tagline: 'Where the supply cable meets the motor leads.',
    internal: false,
    function: 'Houses the connection points between the supply cable and the motor leads and protects the connections from dirt, moisture and accidental contact.',
    material: 'Cast aluminium or iron, or moulded plastic, with a lid and cable-entry knockouts.',
    interactions: 'Mounted on the frame. Brings out the main-winding leads and, in capacitor motors, the capacitor and (where fitted) thermal-protector connections.',
    failure: 'Loose or corroded terminals cause heating, voltage drop, intermittent running or arcing. A missing lid or damaged seal exposes live parts. Wiring must only be done by a qualified person with the supply isolated.',
    keywords: 'terminals junction box connection leads wiring lid',
  },
  {
    id: 'centrifugalSwitch',
    name: 'Centrifugal switch',
    tagline: 'Disconnects the start circuit at about 70-80 % of synchronous speed.',
    internal: true,
    function:
      'Keeps the start circuit (auxiliary winding and start capacitor) connected while the rotor is stationary and opens it automatically once the motor reaches roughly 70-80 % of synchronous speed, so the auxiliary winding and capacitor are not energised while running. The exact cut-out speed depends on the design and spring setting.',
    material: 'Brass or steel flyweights on a shaft-mounted collar with a return spring, plus a stationary contact assembly with silver-alloy contacts on a phenolic board.',
    interactions:
      'The rotating part is mounted on the shaft inside the non-drive-end shield; the stationary contacts are wired in series with the capacitor and auxiliary winding.',
    failure:
      'Stuck open: no start, motor hums. Stuck closed or welded contacts: the start circuit stays energised, causing high current, overheating and early capacitor failure. Dirty or worn contacts cause intermittent starting.',
    note: 'Not every single-phase motor has a centrifugal switch. PSC and shaded-pole motors have no starting switch, and some capacitor-start motors use a current or voltage relay or an electronic switch instead.',
    keywords: 'starting switch cut-out flyweight governor relay contacts',
  },
];

export const COMPONENT_BY_ID = Object.fromEntries(COMPONENTS.map((c) => [c.id, c])) as Record<PartId, MotorComponent>;

/** Case-insensitive search across name, summary and keywords. */
export function searchComponents(query: string): MotorComponent[] {
  const q = query.trim().toLowerCase();
  if (!q) return COMPONENTS;
  return COMPONENTS.filter((c) => `${c.name} ${c.tagline} ${c.keywords}`.toLowerCase().includes(q));
}
