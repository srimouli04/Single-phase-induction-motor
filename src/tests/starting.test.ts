import { describe, expect, it } from 'vitest';
import { CAP_UF, compareMethods, pathCurve, runPoint, type CompareId } from '../simulations/starting';
import { lineCurrent } from '../simulations/metrics';
import { EXAMPLE_MOTOR, solveAtSpeed, syncOmega, type Electrical } from '../simulations/motorModel';

const cmp = compareMethods({ loadTorque: 0.3 });
const by = (id: CompareId) => cmp.methods.find((m) => m.id === id)!;

describe('starting-method comparison', () => {
  it('ranks standstill torque: capacitor-start > split-phase > PSC > 0', () => {
    const t = (id: CompareId) => by(id).start.torqueNet;
    expect(t('capacitor-start')).toBeGreaterThan(t('split-phase'));
    expect(t('split-phase')).toBeGreaterThan(t('psc'));
    expect(t('psc')).toBeGreaterThan(0);
    expect(t('cscr')).toBeGreaterThan(t('capacitor-start')); // C_start + C_run in circuit
  });

  it('split-phase draws more starting current than capacitor-start', () => {
    expect(lineCurrent(by('split-phase').start)).toBeGreaterThan(lineCurrent(by('capacitor-start').start));
  });

  it('the capacitor makes the auxiliary current lead by much more than a resistor does', () => {
    expect(by('split-phase').start.auxLeadDeg).toBeGreaterThan(10);
    expect(by('split-phase').start.auxLeadDeg).toBeLessThan(40);
    expect(by('capacitor-start').start.auxLeadDeg).toBeGreaterThan(70);
    expect(by('capacitor-start').start.auxLeadDeg).toBeLessThanOrEqual(90);
  });

  it('the torque path jumps at the cut-out speed for switched methods only', () => {
    const jumps = (id: CompareId) => {
      const p = by(id).path;
      const out: number[] = [];
      for (let i = 1; i < p.length; i++) if (p[i][0] === p[i - 1][0]) out.push(p[i][1] - p[i - 1][1]);
      return out;
    };
    for (const id of ['split-phase', 'capacitor-start', 'cscr'] as const) {
      const j = jumps(id);
      expect(j, id).toHaveLength(1);
      expect(Math.abs(j[0]), id).toBeGreaterThan(0.05);
      expect(by(id).path.some(([rpm]) => Math.abs(rpm - cmp.cutoutRpm) < 1e-9), id).toBe(true);
    }
    // a PSC motor has no switch: the two points at the end of the path coincide
    expect(jumps('psc').every((d) => Math.abs(d) < 1e-9)).toBe(true);
    // x never decreases (the chart draws left to right)
    for (const m of cmp.methods) for (let i = 1; i < m.path.length; i++) expect(m.path[i][0]).toBeGreaterThanOrEqual(m.path[i - 1][0]);
  });

  it('uses the lab model: the standstill point equals the lab summary, and CSCR is not simulated', () => {
    for (const id of ['split-phase', 'capacitor-start', 'psc'] as const) {
      const s = by(id).summary!;
      expect(s, id).not.toBeNull();
      expect(by(id).start.torqueNet, id).toBeCloseTo(s.startTorque, 9);
      expect(lineCurrent(by(id).start), id).toBeCloseTo(s.startCurrent, 9);
    }
    expect(by('cscr').summary).toBeNull();
  });

  it('CSCR runs on the PSC curve: same running point, same path above the cut-out speed', () => {
    const a = by('cscr');
    const b = by('psc');
    expect(a.runSpeedRpm).toBeCloseTo(b.runSpeedRpm!, 6);
    expect(a.path[a.path.length - 1][1]).toBeCloseTo(b.path[b.path.length - 1][1], 9);
    expect(CAP_UF.start).toBeGreaterThan(CAP_UF.run);
  });

  it('simulation outcome follows the load: PSC stops starting before capacitor-start does', () => {
    const heavy = compareMethods({ loadTorque: 0.8 });
    const outcome = (id: CompareId) => heavy.methods.find((m) => m.id === id)!.summary!.startup.outcome;
    expect(outcome('capacitor-start')).toBe('settles');
    expect(outcome('psc')).toBe('no-start');
  });
});

describe('runPoint', () => {
  it('agrees with the lab simulation for a switched motor (same load and friction)', () => {
    const m = by('capacitor-start');
    const sim = m.summary!.startup.finalSpeedRpm;
    expect(m.runSpeedRpm).not.toBeNull();
    expect(Math.abs(m.runSpeedRpm! - sim) / sim).toBeLessThan(0.01);
  });

  it('returns null when the load exceeds the breakdown torque; at no load the speed is just below synchronous', () => {
    const net: Electrical = { voltage: 120, frequencyHz: 60, poles: 4, aux: null };
    expect(runPoint(EXAMPLE_MOTOR, net, 3.4)).toBeNull();
    // the backward field still drags a little at synchronous speed, so the zero-torque speed is slightly below N_s
    const idle = runPoint(EXAMPLE_MOTOR, net, 0, 0)!;
    expect(idle.speedRpm).toBeGreaterThan(1790);
    expect(idle.speedRpm).toBeLessThan(1800);
    const loaded = runPoint(EXAMPLE_MOTOR, net, 1, 0)!;
    expect(loaded.speedRpm).toBeLessThan(idle.speedRpm);
    expect(loaded.solution.torqueNet).toBeCloseTo(1, 6);
  });

  it('pathCurve runs from standstill to synchronous speed; the net torque there is slightly negative (backward field)', () => {
    const net: Electrical = { voltage: 120, frequencyHz: 60, poles: 4, aux: null };
    const p = pathCurve(EXAMPLE_MOTOR, net, net, 1);
    expect(p[0][0]).toBe(0);
    const last = p[p.length - 1];
    expect(last[0]).toBeCloseTo(1800, 9);
    expect(last[1]).toBeLessThan(0);
    expect(last[1]).toBeGreaterThan(-0.2);
    expect(last[1]).toBeCloseTo(solveAtSpeed(EXAMPLE_MOTOR, net, syncOmega(60, 4)).torqueNet, 9);
  });
});
