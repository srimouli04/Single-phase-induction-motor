// Content and geometry for the "socket to shaft" chain. Pure, so the physics behind the drawing can be unit-tested.
import { DEFAULT_FIELD, rotation } from '../../simulations/field.ts';

/** Time offset so that a frozen drawing (animations paused) still shows both currents and a tilted field. */
export const WT0 = Math.PI / 4;

/** +1 when the drawn field turns counter-clockwise on the screen, -1 when clockwise. Read from the field model, not assumed. */
export const SENSE: 1 | -1 = rotation(DEFAULT_FIELD) === 'ccw' ? 1 : -1;

/** Angle of the field vector [rad, counter-clockwise from +x] at electrical time wt. DEFAULT_FIELD is a circle, so this is SENSE * wt. */
export const fieldAngle = (wt: number): number => SENSE * wt;

/** Slip drawn in stage 6: far larger than a real motor's, so the lag between shaft mark and field arrow can be seen. */
export const DRAWN_SLIP = 0.08;
export const shaftAngle = (wt: number): number => (1 - DRAWN_SLIP) * fieldAngle(wt);

export const BAR_COUNT = 8;
/** Angle of rotor bar k [rad], bars spread evenly and offset half a step from the axes. */
export const barAngle = (k: number, n = BAR_COUNT): number => ((k + 0.5) * 2 * Math.PI) / n;

/** Radial flux density seen by bar k when the field vector points at angle alpha (relative units). */
export const barFlux = (alpha: number, k: number, n = BAR_COUNT): number => Math.cos(barAngle(k, n) - alpha);

/**
 * Current in the bars of a STATIONARY rotor (relative units; positive = out of the page). The turning field induces
 * a voltage proportional to the flux density under each bar, with the sign set by the sense in which the field turns
 * (Faraday and Lenz: the bars are swept backwards relative to the field).
 */
export const barCurrents = (alpha: number, n = BAR_COUNT): number[] => Array.from({ length: n }, (_, k) => SENSE * barFlux(alpha, k, n));

/**
 * Force on each bar along the circle (relative units; positive = counter-clockwise): F = B I L with I out of the page
 * in a radial field gives a tangential force B_r * I. Current and flux reverse together, so all forces share one sign.
 */
export const barForces = (alpha: number, n = BAR_COUNT): number[] => barCurrents(alpha, n).map((i, k) => i * barFlux(alpha, k, n));

export type ChainId = 'supply' | 'windings' | 'field' | 'rotorCurrent' | 'torque' | 'shaft';

export interface ChainStage {
  id: ChainId;
  title: string;
  /** Short line on the card. */
  tag: string;
  text: string;
  eq: string;
  eqNote: string;
  side: 'stator' | 'rotor';
}

export const CHAIN: ChainStage[] = [
  {
    id: 'supply',
    title: 'AC supply',
    tag: 'one alternating voltage',
    side: 'stator',
    text: 'The socket supplies one sinusoidal voltage that reverses direction twice every cycle: 100 or 120 times a second on a 50 or 60 Hz grid. The curve is that voltage, slowed down by more than a hundred times so that you can follow it. This single alternating voltage is the motor’s only source of energy.',
    eq: 'v(t) = √2 V sin(2π f t)',
    eqNote: 'V is the RMS voltage (for example 120 V) and f the frequency (50 or 60 Hz).',
  },
  {
    id: 'windings',
    title: 'Stator windings',
    tag: 'two coils, 90° apart',
    side: 'stator',
    text: 'The supply drives current through copper windings in the slots of the stator. A motor that can start has two: the main winding, and an auxiliary winding placed 90° further round the stator and fed with a current that is shifted in time (the panel below shows how). Each winding on its own makes a flux that only alternates along its own axis. The two arrows grow, shrink and reverse, offset from each other by a quarter of a cycle.',
    eq: 'i_m = I cos ωt,   i_a = I cos(ωt + φ),   φ ≈ 90°',
    eqNote: 'The auxiliary winding’s axis is 90 electrical degrees from the main winding’s axis.',
  },
  {
    id: 'field',
    title: 'Magnetic field',
    tag: 'the sum turns round',
    side: 'stator',
    text: 'Add the two flux vectors and the result is a single vector of constant length that turns once per supply cycle (in a 2-pole winding; a 4-pole motor takes two cycles for one turn). This rotating magnetic field crosses the air gap and enters the rotor. With only the main winding the sum would just slide back and forth along one line and nothing would turn: that is the problem the auxiliary winding solves.',
    eq: 'N_s = 120 f / P',
    eqNote: 'A 4-pole motor on 60 Hz has N_s = 1800 rpm; on 50 Hz, 1500 rpm.',
  },
  {
    id: 'rotorCurrent',
    title: 'Induced rotor current',
    tag: 'no wire to the rotor',
    side: 'rotor',
    text: 'Nothing is plugged into the rotor. Its bars are metal rods joined by an end ring at each end, and the turning field sweeps across them. By Faraday’s law a voltage is induced in every bar; the end rings short the bars together, so current flows: out of the page under one pole, into the page under the other (⊙ and ⊗). Drawn for a rotor at standstill, when the field sweeps past fastest and the induced current is largest.',
    eq: 'e = −dΦ/dt,   f_{rotor} = s f',
    eqNote: 'A turning rotor sees the field sweep past only at the slip speed, so the induced voltage and its frequency are proportional to the slip s.',
  },
  {
    id: 'torque',
    title: 'Torque',
    tag: 'force on every bar',
    side: 'rotor',
    text: 'A bar carrying current in a magnetic field feels a force F = B I L. The current in a bar and the flux through it reverse at the same moment, so every force points the same way round the rotor: the way the field is turning. The arrows are longest under the poles, where flux and current are strongest, and vanish between them. Together the forces make one steady torque. Shown for the rotor at standstill.',
    eq: 'F = B I L,   T = Σ F r',
    eqNote: 'The drawing takes the rotor current to be in step with the induced voltage. In a real rotor leakage inductance delays it, which cuts the torque per ampere; the Physics lab includes that.',
  },
  {
    id: 'shaft',
    title: 'Shaft rotation',
    tag: 'follows, never catches up',
    side: 'rotor',
    text: 'The torque speeds up the rotor and shaft, which turn the same way as the field, and the load (a fan, a pump, a compressor) takes the mechanical power. The rotor can never quite reach the speed of the field: at exactly that speed the bars would see no change of flux, no voltage, no current and no torque. The small lag is called slip. Watch the mark on the shaft fall slowly behind the field arrow.',
    eq: 's = (N_s − N_r) / N_s,   P_{mech} = T ω_r',
    eqNote: `The drawing exaggerates the slip (${Math.round(DRAWN_SLIP * 100)} %) so the lag is visible. A loaded motor typically runs a few percent below synchronous speed.`,
  },
];
