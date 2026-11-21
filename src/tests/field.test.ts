import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FIELD,
  MAIN_ONLY_FIELD,
  ellipseAxes,
  fluxDensity,
  resultant,
  rotatingComponents,
  rotation,
  torqueIndex,
  type FieldInputs,
} from '../simulations/field';

const f = (over: Partial<FieldInputs>): FieldInputs => ({ ...DEFAULT_FIELD, ...over });

describe('double-revolving-field decomposition', () => {
  it('splits a pulsating field into two equal counter-rotating halves with zero torque index', () => {
    const rc = rotatingComponents(MAIN_ONLY_FIELD);
    expect(rc.ccwAmp).toBeCloseTo(0.5, 12);
    expect(rc.cwAmp).toBeCloseTo(0.5, 12);
    expect(rotation(MAIN_ONLY_FIELD)).toBe('pulsating');
    expect(torqueIndex(MAIN_ONLY_FIELD)).toBeCloseTo(0, 12);
    expect(ellipseAxes(MAIN_ONLY_FIELD).minor).toBeCloseTo(0, 12);
  });

  it('the resultant equals the sum of the two rotating components at every instant', () => {
    for (const p of [MAIN_ONLY_FIELD, DEFAULT_FIELD, f({ phaseDeg: 35, axisDeg: 70, iaAmp: 0.6 })]) {
      const { ccw, cw } = rotatingComponents(p);
      for (let k = 0; k < 24; k++) {
        const wt = (k / 24) * 2 * Math.PI;
        const x = ccw.re * Math.cos(wt) - ccw.im * Math.sin(wt) + cw.re * Math.cos(wt) + cw.im * Math.sin(wt);
        const y = ccw.re * Math.sin(wt) + ccw.im * Math.cos(wt) + cw.im * Math.cos(wt) - cw.re * Math.sin(wt);
        const r = resultant(p, wt);
        expect(r.x).toBeCloseTo(x, 10);
        expect(r.y).toBeCloseTo(y, 10);
      }
    }
  });

  it('balanced quadrature windings give a single circular rotating field', () => {
    const rc = rotatingComponents(DEFAULT_FIELD);
    expect(Math.min(rc.ccwAmp, rc.cwAmp)).toBeCloseTo(0, 12);
    expect(Math.max(rc.ccwAmp, rc.cwAmp)).toBeCloseTo(1, 12);
    expect(ellipseAxes(DEFAULT_FIELD).circularity).toBeCloseTo(1, 12);
    // constant magnitude all round the cycle
    for (let k = 0; k < 12; k++) {
      const r = resultant(DEFAULT_FIELD, (k / 12) * 2 * Math.PI);
      expect(Math.hypot(r.x, r.y)).toBeCloseTo(1, 10);
    }
  });

  it('rotates from the leading winding axis towards the lagging one; swapping the lead reverses it', () => {
    expect(rotation(DEFAULT_FIELD)).toBe('cw'); // aux axis at +90 deg and leading -> clockwise
    expect(rotation(f({ phaseDeg: -90 }))).toBe('ccw');
    expect(rotation(f({ axisDeg: -90 }))).toBe('ccw');
    expect(torqueIndex(f({ phaseDeg: -90 }))).toBeCloseTo(-torqueIndex(DEFAULT_FIELD), 12);
  });

  it('standstill torque index follows Im * Ia * sin(gamma) * sin(phi)', () => {
    const idx = (p: Partial<FieldInputs>) => Math.abs(torqueIndex(f(p)));
    expect(idx({ phaseDeg: 30 }) / idx({ phaseDeg: 90 })).toBeCloseTo(Math.sin((30 * Math.PI) / 180), 10);
    expect(idx({ axisDeg: 45 }) / idx({ axisDeg: 90 })).toBeCloseTo(Math.sin((45 * Math.PI) / 180), 10);
    expect(idx({ iaAmp: 0.5 }) / idx({ iaAmp: 1 })).toBeCloseTo(0.5, 10);
    expect(idx({ phaseDeg: 0 })).toBeCloseTo(0, 12); // in-phase currents: pulsating, no starting torque
    expect(idx({ axisDeg: 0 })).toBeCloseTo(0, 12); // coincident windings: pulsating
  });

  it('flux density is a standing wave for the main winding alone', () => {
    // zero crossings stay at theta = +-90 deg for all times
    for (let k = 0; k < 8; k++) {
      const wt = (k / 8) * 2 * Math.PI;
      expect(fluxDensity(MAIN_ONLY_FIELD, wt, Math.PI / 2)).toBeCloseTo(0, 12);
    }
  });
});

import { barEmf, barEmfMoving, componentsAt, fieldTorques, fieldTorqueShape, phasorsAt, RX } from '../simulations/field';

describe('field torques, moving-rotor EMF and component split', () => {
  const cases = [DEFAULT_FIELD, MAIN_ONLY_FIELD, { imAmp: 0.8, iaAmp: 0.5, phaseDeg: 35, axisDeg: 70 }, { imAmp: 1, iaAmp: 1, phaseDeg: -90, axisDeg: 90 }];

  it('one field alone peaks at slip R2/X2 and the torque shape is odd in slip', () => {
    expect(fieldTorqueShape(RX)).toBeCloseTo(1, 12);
    expect(fieldTorqueShape(RX - 0.05)).toBeLessThan(1);
    expect(fieldTorqueShape(RX + 0.05)).toBeLessThan(1);
    expect(fieldTorqueShape(-0.4)).toBeCloseTo(-fieldTorqueShape(0.4), 12);
    expect(fieldTorqueShape(0)).toBe(0);
  });

  it('standstill net torque equals the torque index times the shape at slip 1', () => {
    for (const p of cases) expect(fieldTorques(p, 0).net).toBeCloseTo(torqueIndex(p) * fieldTorqueShape(1), 10);
  });

  it('a main-winding-only (pulsating) field: zero torque at rest, odd about rest, pushed either way it keeps going', () => {
    expect(fieldTorques(MAIN_ONLY_FIELD, 0).net).toBeCloseTo(0, 12);
    for (const r of [0.05, 0.2, 0.5, 0.9]) {
      expect(fieldTorques(MAIN_ONLY_FIELD, r).net).toBeCloseTo(-fieldTorques(MAIN_ONLY_FIELD, -r).net, 12);
      expect(fieldTorques(MAIN_ONLY_FIELD, r).net).toBeGreaterThan(0);
    }
  });

  it('a two-winding field starts the motor in the direction of its rotation', () => {
    expect(fieldTorques(DEFAULT_FIELD, 0).net).toBeLessThan(0); // clockwise field: leading auxiliary current, axis 90 deg counter-clockwise
    expect(fieldTorques({ ...DEFAULT_FIELD, phaseDeg: -90 }, 0).net).toBeGreaterThan(0); // swap the leads: counter-clockwise
    expect(fieldTorques({ ...DEFAULT_FIELD, phaseDeg: 0 }, 0).net).toBeCloseTo(0, 12); // in phase: no rotation, no torque
  });

  it('the bar EMF of a stationary rotor matches barEmf, and a bar turning with a rotating field sees none', () => {
    for (const p of cases) for (const [wt, th] of [[0.3, 1.1], [2.2, -0.7], [5, 3]]) expect(barEmfMoving(p, wt, th, 0)).toBeCloseTo(barEmf(p, wt, th), 12);
    // DEFAULT_FIELD is a pure clockwise field: a rotor turning clockwise at synchronous speed (r = -1) is carried along
    for (const wt of [0.4, 1.9, 4.4]) for (const alpha of [0, 1, 2.5]) expect(barEmfMoving(DEFAULT_FIELD, wt, alpha - wt, -1)).toBeCloseTo(0, 12);
  });

  it('forward + backward components add up to the actual flux density and to the resultant vector', () => {
    for (const p of cases) {
      for (const [wt, th] of [[0.3, 1.1], [2.2, -0.7], [5, 3]]) {
        const c = componentsAt(p, wt, th);
        expect(c.total).toBeCloseTo(fluxDensity(p, wt, th), 12);
      }
      const ph = phasorsAt(p, 1.3);
      const res = resultant(p, 1.3);
      expect(ph.sum.x).toBeCloseTo(res.x, 12);
      expect(ph.sum.y).toBeCloseTo(res.y, 12);
    }
  });
});
