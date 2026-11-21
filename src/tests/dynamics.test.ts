import { describe, expect, it } from 'vitest';
import {
  analyzeStartup,
  buildTorqueTable,
  currentWaveforms,
  initialState,
  interpTorque,
  nextAuxState,
  operatingPoint,
  stableStep,
  stepSim,
} from '../simulations/dynamics';
import {
  DEFAULT_INPUTS,
  EXAMPLE_MOTOR,
  LIMITS,
  POLE_OPTIONS,
  START_METHODS,
  electricalFor,
  solveAtSlip,
  syncOmega,
  type LabInputs,
} from '../simulations/motorModel';

const inputs = (over: Partial<LabInputs> = {}): LabInputs => ({ ...DEFAULT_INPUTS, ...over });
const NS = 1800;

describe('torque table', () => {
  it('reproduces the exact solution at nodes and interpolates in between', () => {
    const p = inputs();
    const tbl = buildTorqueTable(p);
    const e = electricalFor(p, EXAMPLE_MOTOR, true);
    for (const w of [-tbl.omegaS, -50, 0, 90, tbl.omegaS]) {
      const exact = solveAtSlip(EXAMPLE_MOTOR, e, 1 - w / tbl.omegaS).torqueNet;
      expect(interpTorque(tbl.aux!, tbl, w)).toBeCloseTo(exact, 1); // 400-interval table: < 0.05 N.m
    }
    expect(interpTorque(tbl.main, tbl, 10 * tbl.omegaS)).toBe(interpTorque(tbl.main, tbl, tbl.omegaS)); // clamped
  });
});

describe('centrifugal switch', () => {
  it('opens at the cut-out speed and re-closes only after the hysteresis band', () => {
    const p = inputs({ cutoutFraction: 0.75 });
    const wS = syncOmega(60, 4);
    expect(nextAuxState(true, 0.5 * wS, wS, p)).toBe(true);
    expect(nextAuxState(true, 0.76 * wS, wS, p)).toBe(false);
    expect(nextAuxState(false, 0.7 * wS, wS, p)).toBe(false); // inside hysteresis band
    expect(nextAuxState(false, 0.6 * wS, wS, p)).toBe(true);
  });
  it('honours PSC (never switched) and stuck-switch faults', () => {
    const wS = syncOmega(60, 4);
    expect(nextAuxState(true, 0.99 * wS, wS, inputs({ method: 'psc' }))).toBe(true);
    expect(nextAuxState(true, 0, wS, inputs({ switchFault: 'stuck-open' }))).toBe(false);
    expect(nextAuxState(false, 0.99 * wS, wS, inputs({ switchFault: 'stuck-closed' }))).toBe(true);
    expect(nextAuxState(true, 0, wS, inputs({ method: 'main-only' }))).toBe(false);
    expect(nextAuxState(true, 0, wS, inputs({ auxOpen: true }))).toBe(false);
  });
});

describe('startup behaviour of the example motor', () => {
  it('capacitor-start motor accelerates, opens the switch and settles near synchronous speed', () => {
    const a = analyzeStartup(inputs());
    expect(a.outcome).toBe('settles');
    expect(a.finalSpeedRpm).toBeGreaterThan(0.9 * NS);
    expect(a.finalSpeedRpm).toBeLessThan(NS);
    expect(a.finalSlip).toBeGreaterThan(0);
    expect(a.finalSlip).toBeLessThan(0.1);
    expect(a.auxOnAtEnd).toBe(false);
    expect(a.toggles).toBe(1);
    expect(a.timeToSpeed).not.toBeNull();
    expect(a.timeToSpeed!).toBeGreaterThan(0.02);
    expect(a.timeToSpeed!).toBeLessThan(3);
  });

  it('main-winding-only motor does not start from rest but runs in either direction when spun', () => {
    expect(analyzeStartup(inputs({ method: 'main-only' })).outcome).toBe('no-start');
    const fwd = analyzeStartup(inputs({ method: 'main-only' }), { omega0: 0.3 * syncOmega(60, 4) });
    expect(fwd.outcome).toBe('settles');
    expect(fwd.finalSpeedRpm).toBeGreaterThan(0.9 * NS);
    const rev = analyzeStartup(inputs({ method: 'main-only' }), { omega0: -0.3 * syncOmega(60, 4) });
    expect(rev.outcome).toBe('settles');
    expect(rev.finalSpeedRpm).toBeLessThan(-0.9 * NS);
  });

  it('failed capacitor / open auxiliary winding / switch stuck open: no start', () => {
    expect(analyzeStartup(inputs({ auxOpen: true })).outcome).toBe('no-start');
    expect(analyzeStartup(inputs({ switchFault: 'stuck-open' })).outcome).toBe('no-start');
  });

  it('switch stuck closed: motor runs with the start circuit still connected and draws more current', () => {
    const p = inputs({ switchFault: 'stuck-closed' });
    const a = analyzeStartup(p);
    expect(a.outcome).toBe('settles');
    expect(a.auxOnAtEnd).toBe(true);
    const healthy = analyzeStartup(inputs());
    const iStuck = operatingPoint(p, EXAMPLE_MOTOR, a.finalOmega, true).iLine;
    const iOk = operatingPoint(inputs(), EXAMPLE_MOTOR, healthy.finalOmega, false).iLine;
    expect(Math.hypot(iStuck.re, iStuck.im)).toBeGreaterThan(Math.hypot(iOk.re, iOk.im));
  });

  it('a locked rotor never turns', () => {
    const a = analyzeStartup(inputs({ rotorLocked: true }));
    expect(a.maxAbsOmega).toBe(0);
    expect(a.outcome).toBe('no-start');
  });

  it('larger inertia lengthens the start; larger load increases slip; lower voltage increases slip', () => {
    const t = (over: Partial<LabInputs>) => analyzeStartup(inputs(over));
    expect(t({ inertia: 0.02 }).timeToSpeed!).toBeGreaterThan(t({ inertia: 0.002 }).timeToSpeed!);
    expect(t({ loadTorque: 1.6 }).finalSlip).toBeGreaterThan(t({ loadTorque: 0.4 }).finalSlip);
    expect(t({ voltage: 90, loadTorque: 1.2 }).finalSlip).toBeGreaterThan(t({ voltage: 120, loadTorque: 1.2 }).finalSlip);
  });

  it('an overload beyond the breakdown torque cannot settle at running speed', () => {
    const a = analyzeStartup(inputs({ loadTorque: LIMITS.loadTorque.max, method: 'main-only' }), { omega0: 0.9 * syncOmega(60, 4) });
    expect(a.outcome).toBe('stalls');
    expect(a.finalOmega).toBe(0);
  });

  it('low voltage can prevent starting altogether', () => {
    const a = analyzeStartup(inputs({ voltage: 60, loadTorque: 1.2 }));
    expect(['no-start', 'stalls', 'cycles', 'slow']).toContain(a.outcome);
  });
});

describe('simulation stability over the allowed control range', () => {
  it('stays finite, bounded and fast for corner cases of every control', () => {
    const corners: Partial<LabInputs>[] = [];
    for (const frequencyHz of [LIMITS.frequencyHz.min, LIMITS.frequencyHz.max]) {
      for (const poles of [POLE_OPTIONS[0], POLE_OPTIONS[POLE_OPTIONS.length - 1]]) {
        for (const inertia of [LIMITS.inertia.min, LIMITS.inertia.max]) {
          for (const loadTorque of [0, 1, LIMITS.loadTorque.max]) {
            for (const method of START_METHODS.map((m) => m.id)) {
              corners.push({ frequencyHz, poles, inertia, loadTorque, method, voltage: LIMITS.voltage.max, damping: LIMITS.damping.max });
              corners.push({ frequencyHz, poles, inertia, loadTorque, method, voltage: LIMITS.voltage.min, capacitanceUF: LIMITS.capacitanceUF.max });
            }
          }
        }
      }
    }
    const t0 = Date.now();
    for (const c of corners) {
      const p = inputs(c);
      const wS = syncOmega(p.frequencyHz, p.poles);
      const a = analyzeStartup(p, { tMax: 6 });
      for (const w of a.trajectory.omega) {
        expect(Number.isFinite(w)).toBe(true);
        expect(Math.abs(w)).toBeLessThanOrEqual(wS + 1e-9);
      }
      for (const tq of a.trajectory.torque) expect(Number.isFinite(tq)).toBe(true);
      expect(Number.isFinite(a.finalSlip)).toBe(true);
    }
    expect(Date.now() - t0).toBeLessThan(20000);
  });

  it('chooses a step that satisfies the RK4 stability bound', () => {
    const p = inputs({ inertia: LIMITS.inertia.min, poles: 2, frequencyHz: 70 });
    const tbl = buildTorqueTable(p);
    const dt = stableStep(tbl, p);
    expect(dt).toBeLessThanOrEqual(1e-3);
    expect((dt * (tbl.maxSlope + p.damping)) / p.inertia).toBeLessThanOrEqual(0.4 + 1e-12);
  });

  it('stepping a de-energised motor coasts down monotonically', () => {
    const p = inputs({ loadTorque: 0.2 });
    const tbl = buildTorqueTable(p);
    let st = { ...initialState(p, tbl.omegaS, 0.95 * tbl.omegaS), energized: false };
    let prev = st.omega;
    for (let i = 0; i < 3000; i++) {
      st = stepSim(st, tbl, p, 1e-3);
      expect(st.omega).toBeLessThanOrEqual(prev + 1e-12);
      prev = st.omega;
    }
    expect(st.omega).toBeLessThan(0.95 * tbl.omegaS);
  });
});

describe('current waveforms', () => {
  it('have the RMS value of the phasor and the requested number of cycles', () => {
    const p = inputs();
    const sol = operatingPoint(p, EXAMPLE_MOTOR, 0, true);
    const w = currentWaveforms(sol, 60, 2, 480);
    const rms = Math.sqrt(w.slice(0, -1).reduce((a, x) => a + x.main * x.main, 0) / (w.length - 1));
    expect(rms).toBeCloseTo(Math.hypot(sol.iMain.re, sol.iMain.im), 2);
    expect(w[w.length - 1].tMs).toBeCloseTo((2 / 60) * 1000, 9);
  });
});
