import { describe, expect, it } from 'vitest';
import { J, abs, add, c, mul, scale, sub } from '../simulations/complex';
import {
  DEFAULT_INPUTS,
  EXAMPLE_MOTOR,
  LIMITS,
  POLE_OPTIONS,
  START_METHODS,
  backwardSlip,
  breakdownTorque,
  electricalFor,
  forwardSlip,
  isValidPoleCount,
  rotorSpeedFromSlip,
  slipFromSpeeds,
  solveAtSlip,
  solveAtSpeed,
  syncOmega,
  synchronousSpeedRpm,
  validateInputs,
  type LabInputs,
} from '../simulations/motorModel';

const m = EXAMPLE_MOTOR;
const inputs = (over: Partial<LabInputs> = {}): LabInputs => ({ ...DEFAULT_INPUTS, ...over });

describe('synchronous speed N_s = 120 f / P', () => {
  it.each([
    [60, 2, 3600],
    [60, 4, 1800],
    [50, 4, 1500],
    [50, 6, 1000],
    [60, 8, 900],
  ])('f=%d Hz, P=%d -> %d rpm', (f, p, n) => expect(synchronousSpeedRpm(f, p)).toBeCloseTo(n, 9));

  it('rejects invalid frequency and pole counts', () => {
    expect(() => synchronousSpeedRpm(60, 3)).toThrow(RangeError);
    expect(() => synchronousSpeedRpm(60, 0)).toThrow(RangeError);
    expect(() => synchronousSpeedRpm(60, 4.5)).toThrow(RangeError);
    expect(() => synchronousSpeedRpm(0, 4)).toThrow(RangeError);
    expect(() => synchronousSpeedRpm(-50, 4)).toThrow(RangeError);
    expect(() => synchronousSpeedRpm(Number.NaN, 4)).toThrow(RangeError);
    expect(isValidPoleCount(4)).toBe(true);
    expect(isValidPoleCount(5)).toBe(false);
  });

  it('matches the mechanical angular speed 4 pi f / P', () => {
    expect(syncOmega(60, 4)).toBeCloseTo((1800 * 2 * Math.PI) / 60, 9);
  });
});

describe('slip s = (N_s - N_r) / N_s', () => {
  it('computes slip and its limits', () => {
    expect(slipFromSpeeds(1800, 1710)).toBeCloseTo(0.05, 12);
    expect(slipFromSpeeds(1800, 0)).toBe(1); // standstill
    expect(slipFromSpeeds(1800, 1800)).toBe(0); // synchronous
    expect(slipFromSpeeds(1800, -1800)).toBe(2); // synchronous speed in reverse
  });
  it('round-trips with the rotor speed', () => {
    expect(rotorSpeedFromSlip(1800, 0.05)).toBeCloseTo(1710, 9);
  });
  it('forward and backward slips sum to 2', () => {
    for (const s of [0, 0.03, 0.5, 1, 1.7, 2]) expect(forwardSlip(s) + backwardSlip(s)).toBeCloseTo(2, 12);
    expect(backwardSlip(0.04)).toBeCloseTo(1.96, 12);
  });
  it('rejects invalid speeds', () => {
    expect(() => slipFromSpeeds(0, 100)).toThrow(RangeError);
    expect(() => slipFromSpeeds(1800, Number.NaN)).toThrow(RangeError);
  });
});

describe('input validation', () => {
  it('passes valid inputs through unchanged', () => {
    const { inputs: v, issues } = validateInputs({ frequencyHz: 50, poles: 6, voltage: 110 });
    expect(issues).toEqual([]);
    expect(v).toMatchObject({ frequencyHz: 50, poles: 6, voltage: 110 });
  });
  it('clamps out-of-range numbers and reports them', () => {
    const { inputs: v, issues } = validateInputs({ frequencyHz: 500, voltage: -3, loadTorque: 99, inertia: 0 });
    expect(v.frequencyHz).toBe(LIMITS.frequencyHz.max);
    expect(v.voltage).toBe(LIMITS.voltage.min);
    expect(v.loadTorque).toBe(LIMITS.loadTorque.max);
    expect(v.inertia).toBe(LIMITS.inertia.min);
    expect(issues.length).toBe(4);
  });
  it('replaces NaN / junk with defaults', () => {
    const { inputs: v, issues } = validateInputs({ frequencyHz: Number.NaN, voltage: 'abc', capacitanceUF: '', inertia: Infinity });
    expect(v.frequencyHz).toBe(DEFAULT_INPUTS.frequencyHz);
    expect(v.voltage).toBe(DEFAULT_INPUTS.voltage);
    expect(v.capacitanceUF).toBe(DEFAULT_INPUTS.capacitanceUF);
    expect(v.inertia).toBe(DEFAULT_INPUTS.inertia); // Infinity is not a usable value
    expect(issues.length).toBe(4);
  });
  it('only allows valid even pole counts and known enums', () => {
    for (const p of [3, 5, 7, 9, 0, -2, 100, 4.4]) {
      const { inputs: v } = validateInputs({ poles: p });
      expect(POLE_OPTIONS).toContain(v.poles);
    }
    const { inputs: v, issues } = validateInputs({ method: 'warp-drive', switchFault: 'melted' });
    expect(v.method).toBe(DEFAULT_INPUTS.method);
    expect(v.switchFault).toBe('none');
    expect(issues.length).toBe(2);
  });
});

describe('main-winding-only model (ideal symmetric single-phase motor)', () => {
  const eMain = (over: Partial<LabInputs> = {}) => electricalFor(inputs({ method: 'main-only', ...over }), m, false);

  it('has exactly zero net torque at standstill (s = 1)', () => {
    for (const f of [40, 50, 60, 70]) {
      for (const p of POLE_OPTIONS) {
        for (const v of [60, 120, 140]) {
          const r = solveAtSlip(m, eMain({ frequencyHz: f, poles: p, voltage: v }), 1);
          expect(r.torqueNet).toBe(0);
          expect(r.torqueF).toBeGreaterThan(0);
          expect(r.torqueF).toBe(r.torqueB); // equal and opposite forward / backward torques
        }
      }
    }
  });

  it('produces forward torque for 0 < s < 1 and reverse torque for 1 < s < 2 (runs either way if spun)', () => {
    const e = eMain();
    for (const s of [0.05, 0.2, 0.5, 0.9]) expect(solveAtSlip(m, e, s).torqueNet).toBeGreaterThan(0);
    for (const s of [1.1, 1.5, 1.8]) expect(solveAtSlip(m, e, s).torqueNet).toBeLessThan(0);
    // mirror symmetry: T(s) = -T(2 - s)
    expect(solveAtSlip(m, e, 0.3).torqueNet).toBeCloseTo(-solveAtSlip(m, e, 1.7).torqueNet, 10);
  });

  it('has a slightly negative torque at synchronous speed (backward field drags)', () => {
    const t0 = solveAtSlip(m, eMain(), 0).torqueNet;
    expect(t0).toBeLessThan(0);
    expect(Math.abs(t0)).toBeLessThan(0.15);
  });

  it('breakdown torque lies at a reasonable speed and scales with V^2', () => {
    const b120 = breakdownTorque(m, eMain());
    expect(b120.speedRpm).toBeGreaterThan(0.5 * 1800);
    expect(b120.speedRpm).toBeLessThan(0.95 * 1800);
    const b84 = breakdownTorque(m, eMain({ voltage: 84 }));
    expect(b84.torque / b120.torque).toBeCloseTo((84 / 120) ** 2, 6);
  });
});

describe('two-winding solution (symmetrical components)', () => {
  const methods = START_METHODS.filter((x) => x.id !== 'main-only').map((x) => x.id);

  it('satisfies both winding voltage equations and the energy balance', () => {
    for (const method of methods) {
      const e = electricalFor(inputs({ method }), m, true);
      for (const s of [0, 0.05, 0.4, 1, 1.3, 2]) {
        const r = solveAtSlip(m, e, s);
        const k = e.frequencyHz / m.refFrequencyHz;
        const a = m.turnsRatio;
        const xc = e.aux!.capacitanceUF > 0 ? 1e6 / (2 * Math.PI * e.frequencyHz * e.aux!.capacitanceUF) : 0;
        const zAux = c(e.aux!.resistance, m.x1a * k - xc);
        const eq1 = sub(c(e.voltage), add(add(mul(c(m.r1m, m.x1m * k), r.iMain), mul(r.zF, r.iF)), mul(r.zB, r.iB)));
        const eq2 = sub(
          c(e.voltage / a),
          add(mul(scale(zAux, 1 / (a * a)), scale(r.iAux, a)), mul(J, sub(mul(r.zF, r.iF), mul(r.zB, r.iB)))),
        );
        expect(abs(eq1)).toBeLessThan(1e-9);
        expect(abs(eq2)).toBeLessThan(1e-9);
        const losses = r.statorCopperLoss + r.torqueF * r.omegaS + r.torqueB * r.omegaS;
        expect(r.inputPower).toBeCloseTo(losses, 8);
      }
    }
  });

  it('reduces to the main-only network when the auxiliary branch is practically open', () => {
    const e = electricalFor(inputs({ method: 'split-phase' }), m, true);
    const openAux = { ...e, aux: { resistance: 1e9, capacitanceUF: 0 } };
    const mainOnly = { ...e, aux: null };
    for (const s of [0.05, 0.5, 1, 1.6]) {
      expect(solveAtSlip(m, openAux, s).torqueNet).toBeCloseTo(solveAtSlip(m, mainOnly, s).torqueNet, 6);
    }
  });

  it('gives positive starting torque with a capacitor / split-phase winding, and capacitor-start > split-phase > PSC', () => {
    const t = (over: Partial<LabInputs>) => solveAtSlip(m, electricalFor(inputs(over), m, true), 1).torqueNet;
    const cap = t({ method: 'capacitor-start', capacitanceUF: 150 });
    const split = t({ method: 'split-phase', auxResistance: 9 });
    const psc = t({ method: 'psc', capacitanceUF: 25 });
    expect(psc).toBeGreaterThan(0);
    expect(split).toBeGreaterThan(psc);
    expect(cap).toBeGreaterThan(split);
  });

  it('shows a capacitor phase lead of the auxiliary current that grows with a smaller capacitor', () => {
    const lead = (cap: number) => solveAtSlip(m, electricalFor(inputs({ capacitanceUF: cap }), m, true), 1).auxLeadDeg;
    expect(lead(60)).toBeGreaterThan(lead(150));
    expect(lead(150)).toBeGreaterThan(lead(300));
    expect(lead(150)).toBeGreaterThan(60);
    expect(lead(150)).toBeLessThan(120);
  });

  it('reverses the starting torque when the auxiliary leads are swapped', () => {
    const e = electricalFor(inputs({ method: 'capacitor-start' }), m, true);
    const er = electricalFor(inputs({ method: 'capacitor-start', auxReversed: true }), m, true);
    expect(solveAtSlip(m, e, 1).torqueNet).toBeGreaterThan(0);
    expect(solveAtSlip(m, er, 1).torqueNet).toBeCloseTo(-solveAtSlip(m, e, 1).torqueNet, 9);
    expect(solveAtSlip(m, er, 1.5).torqueNet).toBeCloseTo(-solveAtSlip(m, e, 0.5).torqueNet, 9);
  });

  it('torque scales with V^2 (linear network)', () => {
    const t = (v: number) => solveAtSlip(m, electricalFor(inputs({ voltage: v }), m, true), 0.7).torqueNet;
    expect(t(96) / t(120)).toBeCloseTo(0.64, 9);
  });
});

describe('numerical safety over the allowed control range', () => {
  it('never returns NaN / Infinity', () => {
    for (const f of [LIMITS.frequencyHz.min, 50, 60, LIMITS.frequencyHz.max]) {
      for (const p of POLE_OPTIONS) {
        for (const v of [LIMITS.voltage.min, 120, LIMITS.voltage.max]) {
          for (const method of START_METHODS.map((x) => x.id)) {
            for (const cap of [LIMITS.capacitanceUF.min, 100, LIMITS.capacitanceUF.max]) {
              const e = electricalFor(inputs({ frequencyHz: f, poles: p, voltage: v, method, capacitanceUF: cap }), m, true);
              for (let i = 0; i <= 20; i++) {
                const r = solveAtSlip(m, e, (2 * i) / 20);
                expect(Number.isFinite(r.torqueNet)).toBe(true);
                expect(Number.isFinite(r.iLine.re) && Number.isFinite(r.iLine.im)).toBe(true);
                expect(Number.isFinite(r.powerFactor)).toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it('clamps solveAtSpeed to the modelled range (no extrapolation)', () => {
    const e = electricalFor(inputs({ method: 'main-only' }), m, false);
    const w = syncOmega(60, 4);
    expect(solveAtSpeed(m, e, 5 * w).slip).toBe(0);
    expect(solveAtSpeed(m, e, -5 * w).slip).toBe(2);
  });
});
