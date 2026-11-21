// Idealised air-gap field of two windings (sinusoidal space distribution) - a VISUAL ILLUSTRATION model.
// Angles are ELECTRICAL degrees (a P-pole machine repeats the pattern P/2 times round the stator).
import { type Complex, abs, c, polar, scale, add } from './complex.ts';

export interface FieldInputs {
  imAmp: number; // main-winding current amplitude, relative (0..1)
  iaAmp: number; // auxiliary-winding current amplitude, relative (0..1)
  phaseDeg: number; // time lead of the auxiliary current over the main current [deg]
  axisDeg: number; // angle of the auxiliary-winding axis, counter-clockwise from the main axis [deg]
}

export const DEFAULT_FIELD: FieldInputs = { imAmp: 1, iaAmp: 1, phaseDeg: 90, axisDeg: 90 };
export const MAIN_ONLY_FIELD: FieldInputs = { imAmp: 1, iaAmp: 0, phaseDeg: 90, axisDeg: 90 };

const rad = (d: number): number => (d * Math.PI) / 180;

/** i_m(t) = Im cos(wt) */
export const mainCurrent = (p: FieldInputs, wt: number): number => p.imAmp * Math.cos(wt);
/** i_a(t) = Ia cos(wt + phase)  (positive phase = auxiliary current leads) */
export const auxCurrent = (p: FieldInputs, wt: number): number => p.iaAmp * Math.cos(wt + rad(p.phaseDeg));

/** Resultant flux-density vector (x to the right, y up): i_m on the main axis + i_a on the auxiliary axis. */
export function resultant(p: FieldInputs, wt: number): { x: number; y: number } {
  const g = rad(p.axisDeg);
  const ia = auxCurrent(p, wt);
  return { x: mainCurrent(p, wt) + ia * Math.cos(g), y: ia * Math.sin(g) };
}

/** Radial flux density around the air gap: b(theta, t) = i_m cos(theta) + i_a cos(theta - gamma). */
export function fluxDensity(p: FieldInputs, wt: number, theta: number): number {
  return mainCurrent(p, wt) * Math.cos(theta) + auxCurrent(p, wt) * Math.cos(theta - rad(p.axisDeg));
}

/**
 * Induced EMF in a rotor bar at angle theta for a STATIONARY rotor: e = -db/dt (relative units).
 * Positive = current out of the page in the drawing.
 */
export function barEmf(p: FieldInputs, wt: number, theta: number): number {
  const g = rad(p.axisDeg);
  return p.imAmp * Math.sin(wt) * Math.cos(theta) + p.iaAmp * Math.sin(wt + rad(p.phaseDeg)) * Math.cos(theta - g);
}

export interface RotatingComponents {
  ccw: Complex; // phasor of the counter-clockwise component at wt = 0 (rotates as e^{+j wt})
  cw: Complex; // phasor of the clockwise component at wt = 0 (rotates as e^{-j wt})
  ccwAmp: number;
  cwAmp: number;
}

/**
 * Resolve the field into two circular fields rotating in opposite directions:
 *   z(t) = C1 e^{+jwt} + C2 e^{-jwt},  C1 = (Bm + Ba e^{j(gamma+phi)})/2,  C2 = (Bm + Ba e^{j(gamma-phi)})/2
 */
export function rotatingComponents(p: FieldInputs): RotatingComponents {
  const g = rad(p.axisDeg);
  const ph = rad(p.phaseDeg);
  const ccw = scale(add(c(p.imAmp), polar(p.iaAmp, g + ph)), 0.5);
  const cw = scale(add(c(p.imAmp), polar(p.iaAmp, g - ph)), 0.5);
  return { ccw, cw, ccwAmp: abs(ccw), cwAmp: abs(cw) };
}

export type Rotation = 'ccw' | 'cw' | 'pulsating';

/** Dominant direction of the resultant field (pulsating when both rotating components are equal). */
export function rotation(p: FieldInputs, tol = 1e-6): Rotation {
  const { ccwAmp, cwAmp } = rotatingComponents(p);
  if (Math.abs(ccwAmp - cwAmp) <= tol) return 'pulsating';
  return ccwAmp > cwAmp ? 'ccw' : 'cw';
}

/** Semi-axes of the ellipse traced by the resultant vector: major = A_ccw + A_cw, minor = |A_ccw - A_cw|. */
export function ellipseAxes(p: FieldInputs): { major: number; minor: number; circularity: number } {
  const { ccwAmp, cwAmp } = rotatingComponents(p);
  const major = ccwAmp + cwAmp;
  const minor = Math.abs(ccwAmp - cwAmp);
  return { major, minor, circularity: major > 0 ? minor / major : 0 };
}

/**
 * Standstill torque index. At zero speed both rotating fields see the same rotor impedance, so the net
 * torque is proportional to (A_ccw^2 - A_cw^2) = -Im*Ia*sin(gamma)*sin(phi). Counter-clockwise positive,
 * normalised so that Im = Ia = 1, gamma = phi = 90 deg gives magnitude 1.
 */
export function torqueIndex(p: FieldInputs): number {
  const { ccwAmp, cwAmp } = rotatingComponents(p);
  return ccwAmp * ccwAmp - cwAmp * cwAmp;
}

/** Rotor resistance / leakage reactance used by the field illustrations (peak torque of one rotating field at slip 0.3). */
export const RX = 0.3;

/**
 * Torque of ONE unit-amplitude rotating field on a cage rotor at slip s, for constant air-gap flux:
 * t(s) = 2 k s / (k^2 + s^2) with k = R2 / X2. Peaks at 1 when s = k, is odd in s (generating beyond synchronous speed).
 */
export const fieldTorqueShape = (slip: number, rx = RX): number => (2 * rx * slip) / (rx * rx + slip * slip);

export interface FieldTorques {
  /** Torque of the counter-clockwise (forward) field: positive pushes counter-clockwise. */
  forward: number;
  /** Torque of the clockwise (backward) field, signed: negative pushes clockwise. */
  backward: number;
  net: number;
}

/**
 * Torques on a rotor turning at fraction r of synchronous speed (+ = counter-clockwise). The counter-clockwise field has
 * slip 1 - r, the clockwise field slip 1 + r. At r = 0 the net torque is torqueIndex(p) * t(1).
 */
export function fieldTorques(p: FieldInputs, r: number, rx = RX): FieldTorques {
  const { ccwAmp, cwAmp } = rotatingComponents(p);
  const forward = ccwAmp * ccwAmp * fieldTorqueShape(1 - r, rx);
  const backward = -(cwAmp * cwAmp * fieldTorqueShape(1 + r, rx));
  return { forward, backward, net: forward + backward };
}

/**
 * Induced EMF in a rotor bar whose CURRENT absolute angle is theta, with the rotor turning at fraction r of synchronous
 * speed (relative units): e = -(db/dt + r db/dtheta). r = 0 gives barEmf. A bar turning with a field sees no EMF.
 */
export function barEmfMoving(p: FieldInputs, wt: number, theta: number, r: number): number {
  const g = rad(p.axisDeg);
  const ph = rad(p.phaseDeg);
  const dbdt = p.imAmp * Math.sin(wt) * Math.cos(theta) + p.iaAmp * Math.sin(wt + ph) * Math.cos(theta - g);
  const dbdth = p.imAmp * Math.cos(wt) * Math.sin(theta) + p.iaAmp * Math.cos(wt + ph) * Math.sin(theta - g);
  return dbdt + r * dbdth;
}

/** Radial flux density at angle theta split into the forward and backward rotating parts (they add up to fluxDensity). */
export function componentsAt(p: FieldInputs, wt: number, theta: number): { forward: number; backward: number; total: number } {
  const { ccw, cw } = rotatingComponents(p);
  const forward = abs(ccw) * Math.cos(wt - theta + Math.atan2(ccw.im, ccw.re));
  const backward = abs(cw) * Math.cos(-wt - theta + Math.atan2(cw.im, cw.re));
  return { forward, backward, total: forward + backward };
}

/** The forward and backward field vectors (x right, y up) and their sum at time wt: the phasor picture of the same field. */
export function phasorsAt(p: FieldInputs, wt: number): { forward: { x: number; y: number }; backward: { x: number; y: number }; sum: { x: number; y: number } } {
  const { ccw, cw } = rotatingComponents(p);
  const cs = Math.cos(wt);
  const sn = Math.sin(wt);
  const forward = { x: ccw.re * cs - ccw.im * sn, y: ccw.re * sn + ccw.im * cs };
  const backward = { x: cw.re * cs + cw.im * sn, y: -cw.re * sn + cw.im * cs };
  return { forward, backward, sum: { x: forward.x + backward.x, y: forward.y + backward.y } };
}
