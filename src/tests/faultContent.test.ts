import { describe, expect, it } from 'vitest';
import { COMPONENTS } from '../content/components';
import { FAULTS, FAULT_BY_ID, FAULT_GROUPS, FAULTS_FOR_PART, isFaultId } from '../content/faults';
import { declutter, linePath, niceDomain, niceTicks, tickDecimals, type LabelSpec } from '../components/chartMath';
import { fmtDuration, fmtLife } from '../components/format';
import { compareRows, faultEvents, verdict } from '../sections/faults/report';
import { applyFault, DEFAULT_SEVERITY, FAULT_IDS, runFault } from '../simulations/faults';
import { EXAMPLE_MOTOR } from '../simulations/motorModel';

const healthy = runFault('none', 0);

describe('fault content', () => {
  it('has exactly one scenario per fault id, with valid groups, parts and unique titles', () => {
    expect(FAULTS.map((f) => f.id).sort()).toEqual([...FAULT_IDS].sort());
    const groups = new Set(FAULT_GROUPS.map((g) => g.id));
    const parts = new Set(COMPONENTS.map((c) => c.id));
    for (const f of FAULTS) {
      expect(groups.has(f.group), `${f.id} group`).toBe(true);
      expect(parts.has(f.part), `${f.id} part`).toBe(true);
    }
    expect(new Set(FAULTS.map((f) => f.title)).size).toBe(FAULTS.length);
    expect(isFaultId('turn-short')).toBe(true);
    expect(isFaultId('nonsense')).toBe(false);
  });

  it('every scenario explains cause, mechanism, damage, symptoms, checks and protection', () => {
    for (const f of FAULTS) {
      expect(f.cause.length, `${f.id} cause`).toBeGreaterThan(40);
      expect(f.how.length, `${f.id} how`).toBeGreaterThanOrEqual(2);
      expect(f.progression.length, `${f.id} progression`).toBeGreaterThanOrEqual(3);
      expect(f.symptoms.length, `${f.id} symptoms`).toBeGreaterThanOrEqual(2);
      expect(f.checks.length, `${f.id} checks`).toBeGreaterThanOrEqual(2);
      expect(f.protection.length, `${f.id} protection`).toBeGreaterThan(40);
      expect(f.lookFor.length, `${f.id} lookFor`).toBeGreaterThan(20);
      // a slider exists exactly when the scenario has a severity label
      expect(f.severityLabel !== undefined, `${f.id} slider`).toBe(DEFAULT_SEVERITY[f.id] !== undefined);
    }
  });

  it('every component links to at least one valid failure, and every group has scenarios', () => {
    for (const c of COMPONENTS) {
      const ids = FAULTS_FOR_PART[c.id];
      expect(ids.length, c.id).toBeGreaterThan(0);
      for (const id of ids) expect(isFaultId(id), `${c.id} -> ${id}`).toBe(true);
    }
    for (const g of FAULT_GROUPS) expect(FAULTS.some((f) => f.group === g.id), g.id).toBe(true);
  });

  it('"open in the Physics lab" is offered exactly when the lab inputs reproduce the scenario', () => {
    for (const id of FAULT_IDS) {
      const sev = DEFAULT_SEVERITY[id] ?? 1;
      const eff = applyFault(id, sev);
      const r = runFault(id, sev);
      const reproducible = JSON.stringify(eff.motor) === JSON.stringify(EXAMPLE_MOTOR) && eff.coolingFactor === 1 && r.extras.hot === null && r.extras.extraLineCurrentA === 0;
      expect(FAULT_BY_ID[id].inLab, id).toBe(reproducible);
    }
  });
});

describe('fault report text', () => {
  it('verdicts match the physics', () => {
    expect(verdict(healthy, healthy).tone).toBe('ok');
    const turn = verdict(runFault('turn-short', 0.3), healthy);
    expect(turn.tone).toBe('bad');
    expect(turn.label).toMatch(/destroyed/);
    expect(verdict(runFault('cap-open', 1), healthy).tone).toBe('warn'); // protector holds it off
    expect(verdict(runFault('core-short', 0.6), healthy).tone).toBe('warn');
  });

  it('events are in time order and never empty; the healthy motor has a quiet run', () => {
    for (const id of FAULT_IDS) {
      const ev = faultEvents(runFault(id, DEFAULT_SEVERITY[id] ?? 1));
      expect(ev.length, id).toBeGreaterThan(0);
      for (let i = 1; i < ev.length; i++) expect(ev[i].t, id).toBeGreaterThanOrEqual(ev[i - 1].t);
    }
    expect(faultEvents(healthy)).toHaveLength(1);
  });

  it('comparison rows never print NaN or Infinity, and include the RCD row only for ground faults', () => {
    for (const id of FAULT_IDS) {
      for (const sev of [0, 0.5, 1]) {
        const rows = compareRows(runFault(id, sev), healthy);
        expect(new Set(rows.map((r) => r.label)).size, `${id}@${sev} unique labels`).toBe(rows.length);
        for (const r of rows) {
          for (const text of [r.healthy, r.faulted]) expect(text, `${id}@${sev} ${r.label}`).not.toMatch(/NaN|Infinity|undefined/);
        }
        expect(rows.some((r) => r.label.includes('RCD')), `${id} RCD row`).toBe(id === 'ground-fault');
      }
    }
  });
});

describe('duration and life formatting', () => {
  it('formats times and lives readably', () => {
    expect(fmtDuration(0.4)).toBe('0.40 s');
    expect(fmtDuration(36.3)).toBe('36 s');
    expect(fmtDuration(97)).toBe('1 min 37 s');
    expect(fmtDuration(120)).toBe('2 min');
    expect(fmtDuration(2760)).toBe('46 min');
    expect(fmtDuration(3600)).toBe('1.0 h');
    expect(fmtDuration(null)).toBe('–');
    expect(fmtLife(0.5)).toBe('30 min');
    expect(fmtLife(48)).toBe('48 h');
    expect(fmtLife(362384)).toBe('41 years');
    expect(fmtLife(1e7)).toBe('> 100 years');
    expect(fmtLife(Infinity)).toBe('–');
  });
});

describe('chart helpers', () => {
  const box = (l: LabelSpec, dy: number) => ({ x0: l.anchor === 'end' ? l.x - l.w : l.x, x1: (l.anchor === 'end' ? l.x - l.w : l.x) + l.w, y0: l.y + dy - 10, y1: l.y + dy + 3 });
  const overlap = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

  it('declutter leaves separate labels alone and separates overlapping ones', () => {
    const far: LabelSpec[] = [
      { x: 100, y: 50, w: 80, anchor: 'end' },
      { x: 100, y: 120, w: 80, anchor: 'end' },
    ];
    expect(declutter(far)).toEqual([0, 0]);

    const stacked: LabelSpec[] = [0, 4, 8, 12].map((d) => ({ x: 200, y: 100 + d, w: 90, anchor: 'end' }));
    const dy = declutter(stacked);
    const boxes = stacked.map((l, i) => box(l, dy[i]));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `${i} vs ${j}`).toBe(false);
  });

  it('declutter treats fixed labels as obstacles and respects the bounds', () => {
    const fixed: LabelSpec[] = [{ x: 50, y: 100, w: 60, anchor: 'start' }];
    const label: LabelSpec = { x: 60, y: 100, w: 60, anchor: 'start' };
    expect(declutter([label], fixed)).toEqual([-13]); // moves up first
    expect(declutter([label], fixed, [80, 200])).toEqual([13]); // cannot go above y = 80, so it goes down
    expect(declutter([label], fixed, [95, 105])).toEqual([0]); // fits nowhere: stays where it is
  });

  it('declutter honours the label height and the search reach', () => {
    const tall: LabelSpec[] = Array.from({ length: 9 }, () => ({ x: 10, y: 500, w: 40, anchor: 'start', h: 20 }));
    const minGap = (dy: number[]) => {
      const tops = dy.map((d, i) => tall[i].y + d - 17).sort((a, b) => a - b); // top edge = baseline - (h - 3)
      return Math.min(...tops.slice(1).map((t, i) => t - tops[i]));
    };
    const free = [-Infinity, Infinity] as [number, number];
    expect(minGap(declutter(tall, [], free, 23, 5))).toBeGreaterThanOrEqual(20); // 11 places for 9 labels, each 20 px tall
    expect(minGap(declutter(tall, [], free, 23))).toBeLessThan(20); // default reach 3 = 7 places: two labels stay stacked
  });

  it('niceTicks / niceDomain / linePath behave on ordinary and degenerate input', () => {
    const t = niceTicks(0, 1746, 6);
    expect(t[0]).toBeLessThanOrEqual(0);
    expect(t[t.length - 1]).toBeLessThanOrEqual(1746);
    expect(t.every((v, i) => i === 0 || v > t[i - 1])).toBe(true);
    expect(niceTicks(NaN, 1)).toEqual([]);
    expect(niceTicks(5, 5)).toEqual([5]);
    expect(tickDecimals([0, 0.5, 1])).toBe(1);
    const [lo, hi] = niceDomain(3, 3);
    expect(hi).toBeGreaterThan(lo);
    expect(niceDomain(2, 9, true)[0]).toBe(0);
    expect(niceDomain(NaN, 1)).toEqual([0, 1]);
    expect(
      linePath(
        [
          [0, 0],
          [1, NaN],
          [2, 2],
        ],
        (x) => x,
        (y) => y,
      ),
    ).toBe('M0.0,0.0M2.0,2.0');
  });
});
