import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../content/components';
import { DEFAULT_FIELD, MAIN_ONLY_FIELD, resultant } from '../simulations/field';
import { fieldPattern } from '../sections/field/pattern';
import { BAR_COUNT, CHAIN, DRAWN_SLIP, SENSE, barAngle, barCurrents, barForces, fieldAngle, shaftAngle } from '../sections/overview/chain';
import { TOUR_PARTS } from '../sections/overview/tour';

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const ALPHAS = Array.from({ length: 24 }, (_, i) => (i * 2 * Math.PI) / 24 + 0.03);

describe('energy chain content', () => {
  it('walks supply → windings → field → rotor current → torque → shaft, with the stator side first', () => {
    expect(CHAIN.map((s) => s.id)).toEqual(['supply', 'windings', 'field', 'rotorCurrent', 'torque', 'shaft']);
    expect(CHAIN.map((s) => s.side)).toEqual(['stator', 'stator', 'stator', 'rotor', 'rotor', 'rotor']);
    expect(new Set(CHAIN.map((s) => s.title)).size).toBe(CHAIN.length);
    for (const s of CHAIN) {
      expect(s.text.length, `${s.id} text`).toBeGreaterThan(200);
      expect(s.eq.length, `${s.id} equation`).toBeGreaterThan(4);
      expect(s.eqNote.length, `${s.id} note`).toBeGreaterThan(20);
    }
  });

  it('says that the rotor has no electrical connection', () => {
    expect(CHAIN[3].text).toMatch(/Nothing is plugged into the rotor/);
  });
});

describe('chain geometry follows the field model', () => {
  it('turns the drawn field the way DEFAULT_FIELD turns', () => {
    for (const wt of [0, 0.4, 1.3, 2.9, 5.1]) {
      const v = resultant(DEFAULT_FIELD, wt);
      expect(Math.hypot(v.x, v.y)).toBeCloseTo(1, 9); // circular field
      expect(v.x).toBeCloseTo(Math.cos(fieldAngle(wt)), 9);
      expect(v.y).toBeCloseTo(Math.sin(fieldAngle(wt)), 9);
    }
  });

  it('puts bars at distinct, evenly spaced angles', () => {
    const a = Array.from({ length: BAR_COUNT }, (_, k) => barAngle(k));
    for (let k = 1; k < BAR_COUNT; k++) expect(a[k] - a[k - 1]).toBeCloseTo((2 * Math.PI) / BAR_COUNT, 12);
  });

  it('induces currents that cancel in total and whose pattern turns with the field', () => {
    for (const a of ALPHAS) {
      const cur = barCurrents(a);
      expect(sum(cur)).toBeCloseTo(0, 9); // what flows out in some bars returns through the others
      expect(Math.max(...cur)).toBeGreaterThan(0.9);
      expect(Math.min(...cur)).toBeLessThan(-0.9);
      const next = barCurrents(a + (2 * Math.PI) / BAR_COUNT);
      cur.forEach((_, k) => expect(next[k]).toBeCloseTo(cur[(k + BAR_COUNT - 1) % BAR_COUNT], 9));
    }
  });

  it('pushes every bar the same way, with a total that does not depend on the field angle (steady torque)', () => {
    for (const a of ALPHAS) {
      const f = barForces(a);
      for (const fk of f) expect(fk * SENSE).toBeGreaterThanOrEqual(-1e-12);
      expect(sum(f)).toBeCloseTo((SENSE * BAR_COUNT) / 2, 9);
    }
  });

  it('lets the shaft fall behind the field by the drawn slip', () => {
    for (const wt of [0.5, 2, 7, 30]) {
      expect(shaftAngle(wt) / fieldAngle(wt)).toBeCloseTo(1 - DRAWN_SLIP, 12);
      expect(Math.abs(shaftAngle(wt))).toBeLessThan(Math.abs(fieldAngle(wt)));
    }
  });
});

describe('field pattern text', () => {
  it('names pulsating, circular, elliptical, reversed and absent fields', () => {
    expect(fieldPattern(MAIN_ONLY_FIELD)).toBe('Pulsating: stands still');
    expect(fieldPattern({ imAmp: 1, iaAmp: 1, phaseDeg: 0, axisDeg: 90 })).toBe('Pulsating: stands still');
    expect(fieldPattern(DEFAULT_FIELD)).toBe('Circular, turning clockwise');
    expect(fieldPattern({ imAmp: 1, iaAmp: 1, phaseDeg: -90, axisDeg: 90 })).toBe('Circular, turning counter-clockwise');
    expect(fieldPattern({ imAmp: 1, iaAmp: 0.6, phaseDeg: 25, axisDeg: 90 })).toBe('Elliptical, turning clockwise');
    expect(fieldPattern({ imAmp: 0, iaAmp: 0, phaseDeg: 90, axisDeg: 90 })).toBe('No field (no current)');
  });
});

describe('landing-page parts', () => {
  it('only links to components that exist in the explorer', () => {
    const ids = new Set(COMPONENTS.map((c) => c.id as string));
    expect(new Set(TOUR_PARTS).size).toBe(TOUR_PARTS.length);
    for (const id of TOUR_PARTS) expect(ids.has(id), id).toBe(true);
  });
});
