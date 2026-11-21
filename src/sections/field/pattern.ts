import { ellipseAxes, rotation, type FieldInputs } from '../../simulations/field.ts';

export const DIRECTION = { ccw: 'counter-clockwise', cw: 'clockwise', pulsating: 'neither way' } as const;

/** One-line description of the field the two windings make: "Circular, turning clockwise", "Pulsating: stands still", ... */
export function fieldPattern(p: FieldInputs): string {
  const e = ellipseAxes(p);
  if (e.major < 1e-6) return 'No field (no current)';
  const rot = rotation(p, 1e-3);
  if (rot === 'pulsating') return 'Pulsating: stands still';
  return `${e.circularity > 0.97 ? 'Circular' : 'Elliptical'}, turning ${DIRECTION[rot]}`;
}
