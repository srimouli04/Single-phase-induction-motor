// Shared layout data for the 3D scene and the 2D fallback: part ids, explosion paths.
export type PartId =
  | 'housing'
  | 'stator'
  | 'mainWinding'
  | 'auxWinding'
  | 'capacitor'
  | 'rotor'
  | 'shaft'
  | 'airGap'
  | 'bearings'
  | 'endShields'
  | 'fan'
  | 'fanCover'
  | 'terminalBox'
  | 'centrifugalSwitch';

export type Vec3 = [number, number, number];

interface ExplodeSpec {
  dir: Vec3; // displacement (model units) when fully exploded (explode = 1)
  start: number; // explode value at which this part starts to move
  end: number; // explode value at which it reaches `dir`
}

/**
 * Staged explosion. Parts that slide along the shaft axis (x) start immediately; the housing, windings and
 * attachments separate radially later, so the "partial" view shows the rotor being withdrawn from an intact stator.
 * Keys are `id` or `id:slot` (two bearings, two end shields).
 */
export const EXPLODE: Record<string, ExplodeSpec> = {
  fanCover: { dir: [-2.9, 0, 0], start: 0, end: 1 },
  fan: { dir: [-2.0, 0, 0], start: 0, end: 1 },
  'endShields:nde': { dir: [-1.5, 0, 0], start: 0, end: 0.8 },
  'bearings:nde': { dir: [-0.85, 0, 0], start: 0, end: 0.8 },
  centrifugalSwitch: { dir: [-0.5, 0, 0], start: 0, end: 0.8 },
  'endShields:de': { dir: [0.4, 0, 0], start: 0, end: 0.5 },
  'bearings:de': { dir: [0.7, 0, 0], start: 0, end: 0.6 },
  shaft: { dir: [2.7, 0, 0], start: 0.35, end: 1 },
  rotor: { dir: [2.7, 0, 0], start: 0.35, end: 1 },
  housing: { dir: [0, 1.9, 0], start: 0.45, end: 1 },
  terminalBox: { dir: [0.3, 3.0, 0.3], start: 0.45, end: 1 },
  capacitor: { dir: [-0.3, 2.8, -0.3], start: 0.45, end: 1 },
  mainWinding: { dir: [0, -1.6, -2.1], start: 0.45, end: 1 },
  auxWinding: { dir: [0, -1.6, 2.1], start: 0.45, end: 1 },
};

/** Displacement of a part for a given explosion amount (0 = assembled, 1 = fully exploded, up to 1.5 = extra spread). */
export function explodeOffset(key: string, explode: number): Vec3 {
  const spec = EXPLODE[key];
  if (!spec) return [0, 0, 0];
  const t = explode <= 1 ? Math.min(1, Math.max(0, (explode - spec.start) / (spec.end - spec.start))) : 1 + (explode - 1);
  return [spec.dir[0] * t, spec.dir[1] * t, spec.dir[2] * t];
}

/** Camera target and distance used by "Show in context" (assembled coordinates). */
export const FOCUS: Record<PartId, { at: Vec3; dist: number }> = {
  housing: { at: [0, 0.2, 0], dist: 8.3 },
  stator: { at: [0, 0, 0], dist: 6.2 },
  mainWinding: { at: [0, 0, 0], dist: 5.7 },
  auxWinding: { at: [0, 0, 0], dist: 5.7 },
  capacitor: { at: [-0.35, 1.0, 0], dist: 5.5 },
  rotor: { at: [0, 0, 0], dist: 6 },
  shaft: { at: [0.3, 0, 0], dist: 8.3 },
  airGap: { at: [0, 0.2, 0], dist: 4.7 },
  bearings: { at: [0, 0, 0], dist: 6.8 },
  endShields: { at: [0, 0, 0], dist: 7.3 },
  fan: { at: [-1.55, 0, 0], dist: 5.5 },
  fanCover: { at: [-1.7, 0, 0], dist: 6.5 },
  terminalBox: { at: [0.45, 1.1, 0], dist: 4.9 },
  centrifugalSwitch: { at: [-0.9, 0, 0], dist: 4.9 },
};

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Point the camera looks at to frame the whole motor for a given explosion amount. */
export const framingTarget = (explode: number): Vec3 => {
  const k = clamp(explode, 0, 1.3);
  return [0.2 - 0.1 * k, 0.2 + 0.9 * k, 0];
};

/** Camera distance (vertical fov 38 degrees) that frames the whole motor for an explosion amount and canvas aspect (w / h). */
export const fitDistance = (explode: number, aspect = 1.5): number => {
  const e = clamp(explode, 0, 1.3);
  const width = 4.8 + 5.8 * e; // extent along the shaft
  const height = 3.4 + 5.6 * e; // housing and terminal box lift, windings drop (plus their projected depth)
  const t = Math.tan((38 / 2) * (Math.PI / 180));
  return 1.08 * Math.max(width / (2 * t * Math.max(aspect, 0.3)), height / (2 * t));
};

/** Short on-screen label for each label key. */
export const LABEL_TEXT: Record<string, string> = {
  housing: 'Frame',
  stator: 'Stator core',
  mainWinding: 'Main winding',
  auxWinding: 'Aux winding',
  capacitor: 'Capacitor',
  rotor: 'Rotor',
  shaft: 'Shaft',
  airGap: 'Air gap',
  'bearings:de': 'Bearing (DE)',
  'bearings:nde': 'Bearing (NDE)',
  'endShields:de': 'End shield (DE)',
  'endShields:nde': 'End shield (NDE)',
  fan: 'Fan',
  fanCover: 'Fan cover',
  terminalBox: 'Terminal box',
  centrifugalSwitch: 'Centrifugal switch',
};

/** Where each label sits (assembled coordinates, relative to the part's own explosion offset). */
export const LABEL_AT: Record<string, Vec3> = {
  housing: [-0.2, 1.22, 0.5],
  stator: [0.0, -0.88, 0.55],
  mainWinding: [0.78, 0.45, 0.58],
  auxWinding: [0.8, -0.5, 0.5],
  capacitor: [-0.45, 1.62, 0],
  rotor: [0.2, 0.52, 0.2],
  shaft: [2.35, 0.2, 0],
  airGap: [0.25, -0.53, 0.3],
  'bearings:de': [1.12, 0.36, 0],
  'bearings:nde': [-1.12, -0.38, 0.1],
  'endShields:de': [1.05, -0.95, 0.3],
  'endShields:nde': [-1.05, -0.95, 0.3],
  fan: [-1.55, 0.35, 0.45],
  fanCover: [-1.9, 0.95, 0],
  terminalBox: [0.45, 1.55, 0],
  centrifugalSwitch: [-0.9, 0.6, 0],
};
