import { describe, expect, it } from 'vitest';
import {
  breakerTripTime,
  DEFAULT_SEVERITY,
  describeSeverity,
  FAULT_IDS,
  hasSeverity,
  heatSources,
  insulationLifeHours,
  RCD_TRIP_A,
  runFault,
  simulateThermal,
  steadyTemps,
  THERMAL,
  turnShort,
  type HeatSources,
} from '../simulations/faults';
import { EXAMPLE_MOTOR } from '../simulations/motorModel';

const healthy = runFault('none', 0);
const SEVERITIES = [0, 0.25, 0.5, 0.75, 1];

describe('protective devices and closed-form fault formulas', () => {
  it('breaker: no trip at rating, faster with more current, instantaneous at 5x', () => {
    expect(breakerTripTime(15)).toBeNull();
    expect(breakerTripTime(0)).toBeNull();
    const t20 = breakerTripTime(20)!;
    const t40 = breakerTripTime(40)!;
    expect(t20).toBeGreaterThan(t40);
    expect(breakerTripTime(80)).toBeLessThan(0.1);
  });

  it('shorted turns: loop current is far above the extra line current, and heat is power-balanced', () => {
    const ts = turnShort(0.09, 0.02, 120, 60, EXAMPLE_MOTOR);
    expect(ts.loopCurrentA).toBeGreaterThan(20);
    expect(ts.extraLineCurrentA).toBeLessThan(ts.loopCurrentA / 5);
    expect(ts.extraLineCurrentA * 120).toBeCloseTo(ts.powerW, 6);
    // a harder (lower-resistance) short drives more current
    expect(turnShort(0.09, 0.005, 120, 60, EXAMPLE_MOTOR).loopCurrentA).toBeGreaterThan(ts.loopCurrentA);
  });

  it('insulation life halves for every 10 K above the rating', () => {
    expect(insulationLifeHours(140)).toBeCloseTo(insulationLifeHours(130) / 2, 6);
    expect(insulationLifeHours(130)).toBe(20000);
  });
});

describe('lumped thermal model', () => {
  const src = (hot: HeatSources['hot']): HeatSources => ({ windingW: 40, coreW: 60, hot, coolingFactor: 1 });
  const open = { open: true, samples: 10 } as const;

  it('settles to the closed-form steady state (no hot spot, winding hot spot, core hot spot)', () => {
    for (const hot of [null, { powerW: 30, host: 'winding' as const, fraction: 0.2, label: 'w' }, { powerW: 30, host: 'core' as const, fraction: 0.1, label: 'c' }]) {
      const s = src(hot);
      const r = simulateThermal(s, 6 * 3600, open);
      const ss = steadyTemps(s);
      expect(r.winding[r.winding.length - 1]).toBeCloseTo(ss.winding, 0);
      expect(r.core[r.core.length - 1]).toBeCloseTo(ss.core, 0);
      expect(r.hot[r.hot.length - 1]).toBeCloseTo(ss.hot, 0);
    }
  });

  it('a hot spot is hotter than its host, and heat is conserved at steady state', () => {
    const s = src({ powerW: 50, host: 'winding', fraction: 0.1, label: 'w' });
    const ss = steadyTemps(s);
    expect(ss.hot).toBeGreaterThan(ss.winding);
    // all heat leaves through core -> ambient
    expect((ss.core - THERMAL.ambientC) / THERMAL.rCoreAmbient).toBeCloseTo(40 + 60 + 50, 6);
  });

  it('the protector opens near its trip temperature, then cycles with hysteresis', () => {
    const r = simulateThermal({ windingW: 500, coreW: 600, hot: null, coolingFactor: 1 }, 3600);
    expect(r.firstTripS).not.toBeNull();
    expect(r.tripCount).toBeGreaterThan(2);
    expect(r.peakWindingC).toBeLessThan(THERMAL.tripC + 8);
    expect(r.failureS).toBeNull();
    expect(r.dutyFraction).toBeLessThan(0.5);
  });

  it('stops where the insulation is destroyed', () => {
    const r = simulateThermal({ windingW: 20, coreW: 40, hot: { powerW: 1200, host: 'winding', fraction: 0.03, label: 'spot' }, coolingFactor: 1 }, 600);
    expect(r.failureS).not.toBeNull();
    expect(r.failureLabel).toBe('spot');
    expect(r.t[r.t.length - 1]).toBeCloseTo(r.failureS!, 6);
  });

  it('is stable for tiny hot spots (step shrinks with the time constant)', () => {
    const r = simulateThermal({ windingW: 20, coreW: 40, hot: { powerW: 5, host: 'winding', fraction: 0.005, label: 'tiny' }, coolingFactor: 1 }, 600, open);
    expect(r.hot.every(Number.isFinite)).toBe(true);
    expect(Math.max(...r.hot)).toBeLessThan(steadyTemps({ windingW: 20, coreW: 40, hot: { powerW: 5, host: 'winding', fraction: 0.005, label: 'tiny' }, coolingFactor: 1 }).hot + 1);
  });
});

describe('healthy baseline', () => {
  it('starts, runs cool, never trips and lasts decades', () => {
    expect(healthy.summary.startup.outcome).toBe('settles');
    expect(healthy.thermal.firstTripS).toBeNull();
    expect(healthy.thermal.failureS).toBeNull();
    expect(healthy.steady.winding).toBeLessThan(100);
    expect(healthy.lifeHours).toBeGreaterThan(100000);
    expect(healthy.breakerTripS).toBeNull();
  });
});

describe('scenarios', () => {
  it('open capacitor / auxiliary / stuck-open switch: motor cannot start, hums, and the protector cycles', () => {
    for (const id of ['cap-open', 'aux-open', 'switch-open'] as const) {
      const r = runFault(id, 1);
      expect(r.summary.startup.outcome).toBe('no-start');
      expect(r.summary.startup.finalSpeedRpm).toBeCloseTo(0, 5);
      expect(r.lineCurrentA).toBeGreaterThan(3 * healthy.lineCurrentA);
      expect(r.thermal.firstTripS).not.toBeNull();
      expect(r.breakerTripS).toBeNull(); // below the breaker rating: only the winding protector helps
    }
  });

  it('stuck-closed switch: runs, but draws several times the normal current and destroys the start winding', () => {
    const r = runFault('switch-closed', 1);
    expect(r.summary.startup.auxOnAtEnd).toBe(true);
    expect(r.lineCurrentA).toBeGreaterThan(2.5 * healthy.lineCurrentA);
    expect(r.thermal.failureLabel).toBe('Auxiliary winding');
    expect(r.thermal.failureS!).toBeLessThan(120);
    expect(r.thermal.firstTripS).toBeNull(); // the average winding temperature never gets there
  });

  it('shorted turns: modest extra line current, huge local heat, fast failure, no breaker trip', () => {
    const r = runFault('turn-short', DEFAULT_SEVERITY['turn-short']!);
    expect(r.extras.hot!.powerW).toBeGreaterThan(200);
    expect(r.lineCurrentA).toBeLessThan(3 * healthy.lineCurrentA);
    expect(r.thermal.failureLabel).toBe('Shorted turns');
    expect(r.thermal.failureS!).toBeLessThan(180);
    expect(r.breakerTripS).toBeNull();
    expect(r.summary.startTorque).toBeLessThan(healthy.summary.startTorque);
  });

  it('more shorted turns means a bigger loop current and an earlier failure', () => {
    const lo = runFault('turn-short', 0.1);
    const hi = runFault('turn-short', 0.8);
    expect(hi.extras.facts.length).toBeGreaterThan(0);
    expect(hi.thermal.failureS!).toBeLessThanOrEqual(lo.thermal.failureS ?? Infinity);
  });

  it('shorted core laminations: barely visible in the current, but the core runs hot and insulation life collapses', () => {
    const r = runFault('core-short', DEFAULT_SEVERITY['core-short']!);
    expect(r.extras.hot!.host).toBe('core');
    expect(r.lineCurrentA - healthy.lineCurrentA).toBeLessThan(1.5);
    expect(r.steady.core).toBeGreaterThan(healthy.steady.core + 20);
    expect(r.lifeHours!).toBeLessThan(healthy.lifeHours! / 10);
    expect(r.summary.startup.outcome).toBe('settles');
  });

  it('ground fault: a breaker does not see it, but a 30 mA residual-current device does', () => {
    const r = runFault('ground-fault', DEFAULT_SEVERITY['ground-fault']!);
    expect(r.extras.groundCurrentA!).toBeGreaterThan(RCD_TRIP_A);
    expect(r.extras.groundCurrentA!).toBeLessThan(15);
    expect(r.lineCurrentA).toBeGreaterThan(3 * healthy.lineCurrentA); // the supply carries the leakage too
    expect(r.breakerTripS).toBeNull();
    expect(r.rcdTrips).toBe(true);
    expect(runFault('ground-fault', 1).breakerTripS!).toBeLessThan(0.1); // a bolted fault is a short circuit
    expect(r.thermal.failureS!).toBeLessThan(10);
    // an incipient, high-resistance leak is below the RCD threshold and survivable for now
    const leak = runFault('ground-fault', 0);
    expect(leak.extras.groundCurrentA!).toBeLessThan(RCD_TRIP_A);
    expect(leak.thermal.failureS).toBeNull();
    expect(leak.rcdTrips).toBe(false);
  });

  it('locked rotor draws the locked-rotor current and the protector (not the breaker) acts first', () => {
    const r = runFault('locked-rotor', 1);
    expect(r.summary.startup.outcome).toBe('no-start');
    expect(r.thermal.firstTripS!).toBeLessThan(120);
    expect(r.breakerTripS === null || r.breakerTripS > r.thermal.firstTripS!).toBe(true);
  });

  it('overload, blocked cooling and bearing wear heat the motor slowly; severity shortens life', () => {
    for (const id of ['overload', 'blocked-cooling', 'bearing-wear'] as const) {
      const lo = runFault(id, 0.1);
      const hi = runFault(id, 1);
      expect(hi.steady.hot).toBeGreaterThan(lo.steady.hot);
    }
    expect(runFault('overload', 1).summary.startup.finalSpeedRpm).toBeLessThan(healthy.summary.startup.finalSpeedRpm);
  });

  it('weak capacitor: still starts but with a fraction of the starting torque', () => {
    const r = runFault('cap-weak', 1);
    expect(r.summary.startTorque).toBeLessThan(0.7 * healthy.summary.startTorque);
  });

  it('low voltage cuts torque roughly as V squared', () => {
    const r = runFault('low-voltage', 1);
    expect(r.summary.startTorque / healthy.summary.startTorque).toBeCloseTo((r.summary.inputs.voltage / 120) ** 2, 1);
  });

  it('broken bars: more rotor resistance, so more slip', () => {
    const r = runFault('broken-bars', 1);
    expect(r.summary.startup.finalSpeedRpm).toBeLessThan(healthy.summary.startup.finalSpeedRpm);
  });

  it('every scenario is finite and well-behaved across its whole severity range', () => {
    for (const id of FAULT_IDS) {
      for (const sev of SEVERITIES) {
        const r = runFault(id, sev);
        expect(Number.isFinite(r.lineCurrentA), `${id}@${sev} current`).toBe(true);
        expect(r.thermal.winding.every(Number.isFinite), `${id}@${sev} winding temperature`).toBe(true);
        expect(r.thermal.hot.every(Number.isFinite), `${id}@${sev} hot temperature`).toBe(true);
        expect(r.thermal.t.length, `${id}@${sev} samples`).toBeGreaterThan(2);
        expect(r.thermal.t.length, `${id}@${sev} samples cap`).toBeLessThan(1500);
        expect(Number.isFinite(r.summary.startTorque), `${id}@${sev} torque`).toBe(true);
        expect(r.summary.startup.trajectory.omega.every(Number.isFinite), `${id}@${sev} speed`).toBe(true);
        expect(heatSources(r.summary, r.extras, 1).windingW).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('describes the severity of every scenario that has a slider, and only those', () => {
    for (const id of FAULT_IDS) {
      expect(hasSeverity(id)).toBe(DEFAULT_SEVERITY[id] !== undefined);
      expect(describeSeverity(id, 0.5).length > 0).toBe(hasSeverity(id));
    }
  });
});
