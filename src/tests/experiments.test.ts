import { describe, expect, it } from 'vitest';
import { isFaultId } from '../content/faults';
import { EXPERIMENTS, EXPERIMENT_BY_ID, measureExperiment } from '../content/experiments';
import { isSectionId } from '../content/sections';
import { METRICS, formatMetric, measureField, measureLab, num } from '../simulations/experiments';
import { DEFAULT_INPUTS, validateInputs } from '../simulations/motorModel';

describe('guided experiments: structure', () => {
  it('has eight experiments with unique ids and titles', () => {
    expect(EXPERIMENTS).toHaveLength(8);
    expect(new Set(EXPERIMENTS.map((e) => e.id)).size).toBe(8);
    expect(new Set(EXPERIMENTS.map((e) => e.title)).size).toBe(8);
    expect(Object.keys(EXPERIMENT_BY_ID)).toHaveLength(8);
    for (const lvl of ['Starter', 'Core', 'Challenge']) expect(EXPERIMENTS.some((e) => e.level === lvl), lvl).toBe(true);
  });

  it('offers three options a, b, c with feedback, exactly one of them correct', () => {
    for (const e of EXPERIMENTS) {
      expect(e.options.map((o) => o.id), e.id).toEqual(['a', 'b', 'c']);
      expect(e.options.filter((o) => o.id === e.correct), e.id).toHaveLength(1);
      for (const o of e.options) {
        expect(o.text.length, `${e.id} ${o.id} text`).toBeGreaterThan(8);
        expect(o.why.length, `${e.id} ${o.id} feedback`).toBeGreaterThan(40);
      }
      expect(e.question.endsWith('?') || e.question.endsWith(':'), e.id).toBe(true);
      expect(e.steps.length, `${e.id} steps`).toBeGreaterThanOrEqual(3);
      expect(e.why.length, `${e.id} why`).toBeGreaterThan(200);
      expect(e.takeaway.length, `${e.id} takeaway`).toBeGreaterThan(40);
      expect(e.claims.length, `${e.id} claims`).toBeGreaterThanOrEqual(3);
      expect(e.runs.length, `${e.id} runs`).toBeGreaterThanOrEqual(2);
    }
  });

  it('opens only things that exist, with settings the lab accepts unchanged', () => {
    for (const e of EXPERIMENTS) {
      expect(e.open.length, e.id).toBeGreaterThanOrEqual(1);
      for (const o of e.open) {
        expect(isSectionId(o.target), `${e.id} ${o.target}`).toBe(true);
        if (o.target === 'lab') {
          expect(o.handoff.lab, `${e.id} lab handoff`).toBeDefined();
          expect(validateInputs({ ...DEFAULT_INPUTS, ...o.handoff.lab }).issues, `${e.id} lab handoff issues`).toEqual([]);
        }
        if (o.target === 'faults') expect(isFaultId(o.handoff.fault), `${e.id} fault ${o.handoff.fault}`).toBe(true);
        if (o.target === 'field') expect(['pulsating', 'double', 'twoWinding']).toContain(o.handoff.field?.mode);
      }
    }
  });

  it('shows only columns that exist and that the measurement fills in', () => {
    for (const e of EXPERIMENTS) {
      const rows = measureExperiment(e);
      expect(rows, e.id).toHaveLength(e.runs.length);
      for (const c of e.columns) {
        expect(METRICS[c], `${e.id} ${c}`).toBeDefined();
        for (const r of rows) expect(r.v[c], `${e.id} / ${r.label} / ${c}`).not.toBeUndefined();
      }
    }
  });
});

describe('guided experiments: every claim in the text is true of the model', () => {
  for (const e of EXPERIMENTS) {
    it(e.id, () => {
      const rows = measureExperiment(e);
      for (const c of e.claims) expect(c.holds(rows), c.text).toBe(true);
    });
  }
});

describe('experiment measurement', () => {
  it('reports no-start and a steady current for a motor that hums, and nothing for one that hunts', () => {
    const hum = measureLab({ label: 'hum', patch: { method: 'main-only' } });
    expect(hum.outcome).toBe('no-start');
    expect(hum.v.speedRpm).toBe(0);
    expect(num(hum, 'steadyCurrent')).toBeGreaterThan(10);
    const hunt = measureLab({ label: 'hunt', patch: { loadTorque: 2, voltage: 96 } });
    expect(hunt.outcome).toBe('cycles');
    expect(hunt.v.speedRpm).toBeNull();
    expect(hunt.v.steadyCurrent).toBeNull();
  });

  it('measures the speed with its sign and the slip from its size', () => {
    const fwd = measureLab({ label: 'f', patch: {} });
    const rev = measureLab({ label: 'r', patch: { auxReversed: true } });
    expect(num(rev, 'speedRpm')).toBeCloseTo(-num(fwd, 'speedRpm'), 6);
    expect(num(rev, 'slipPct')).toBeCloseTo(num(fwd, 'slipPct'), 6);
    expect(num(fwd, 'slipPct')).toBeGreaterThan(0);
  });

  it('leaves the auxiliary metrics empty when the auxiliary branch is not connected at standstill', () => {
    for (const patch of [{ method: 'main-only' as const }, { switchFault: 'stuck-open' as const }, { auxOpen: true }]) {
      const r = measureLab({ label: 'no aux', patch });
      expect(r.v.leadDeg).toBeNull();
      expect(r.v.auxStartCurrent).toBeNull();
    }
    expect(num(measureLab({ label: 'aux', patch: {} }), 'leadDeg')).toBeGreaterThan(0);
  });

  it('refuses a run whose settings had to be repaired, and a missing number', () => {
    expect(() => measureLab({ label: 'bad', patch: { voltage: 1000 } })).toThrow(RangeError);
    expect(() => num(measureField('x', 0), 'startTorque')).toThrow(TypeError);
  });

  it('formats numbers without a negative zero and shows a dash for no value', () => {
    expect(formatMetric('startTorque', 3.3891)).toBe('3.39');
    expect(formatMetric('startTorque', -0.0000001)).toBe('0.00');
    expect(formatMetric('speedRpm', -1745.6)).toBe('-1746');
    expect(formatMetric('speedRpm', null)).toBe('–');
    expect(formatMetric('outcome', 'Does not start')).toBe('Does not start');
  });
});
