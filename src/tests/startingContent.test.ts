import { describe, expect, it } from 'vitest';
import { METHOD_BY_ID, METHOD_IDS, PART_INFO, STARTING_METHODS, isMethodId, type PartKey } from '../content/startingMethods';
import { AUX_KINDS, KIND_H, angleBetween, layoutBranch, polar, sloshDots } from '../sections/starting/circuits';
import { START_METHODS } from '../simulations/motorModel';

describe('starting-method content', () => {
  it('has one complete entry per method, in a fixed order', () => {
    expect(STARTING_METHODS.map((m) => m.id)).toEqual([...METHOD_IDS]);
    expect(new Set(STARTING_METHODS.map((m) => m.title)).size).toBe(STARTING_METHODS.length);
    const labMethods = new Set(START_METHODS.map((m) => m.id as string));
    for (const m of STARTING_METHODS) {
      expect(m.principle.length, `${m.id} principle`).toBeGreaterThan(200);
      expect(m.sequence.length, `${m.id} steps`).toBeGreaterThanOrEqual(4);
      expect(m.strengths.length, `${m.id} strengths`).toBeGreaterThanOrEqual(1);
      expect(m.limits.length, `${m.id} limits`).toBeGreaterThanOrEqual(1);
      expect(m.uses.length, `${m.id} uses`).toBeGreaterThanOrEqual(2);
      expect(m.lookFor.length, `${m.id} lookFor`).toBeGreaterThan(30);
      for (const [k, v] of Object.entries(m.typical)) expect(v.length, `${m.id} typical.${k}`).toBeGreaterThan(2);
      if (m.lab !== null) expect(labMethods.has(m.lab), `${m.id} lab method`).toBe(true);
    }
    expect(METHOD_BY_ID.cscr.lab).toBeNull(); // not a lab option: analytical only
    expect(METHOD_BY_ID['shaded-pole'].lab).toBeNull(); // qualitative only
    expect(STARTING_METHODS.filter((m) => m.switched).map((m) => m.id)).toEqual(['split-phase', 'capacitor-start', 'cscr']);
  });

  it('says honestly what is not modelled', () => {
    expect(METHOD_BY_ID.cscr.note).toMatch(/not simulated/);
    expect(METHOD_BY_ID['shaded-pole'].note).toMatch(/no torque or current numbers/);
  });

  it('describes every clickable part', () => {
    const keys: PartKey[] = ['supply', 'main', 'aux', 'switch', 'startCap', 'runCap', 'auxR', 'coil', 'unshaded', 'ring', 'rotor'];
    expect(Object.keys(PART_INFO).sort()).toEqual([...keys].sort());
    for (const k of keys) {
      expect(PART_INFO[k].name.length).toBeGreaterThan(3);
      expect(PART_INFO[k].role.length, `${k} role`).toBeGreaterThan(60);
      expect(PART_INFO[k].fails.length, `${k} fails`).toBeGreaterThan(30);
    }
  });

  it('recognises method ids', () => {
    expect(isMethodId('psc')).toBe(true);
    expect(isMethodId('nonsense')).toBe(false);
    expect(isMethodId(undefined)).toBe(false);
  });
});

describe('circuit geometry', () => {
  it('fits every auxiliary branch between the rails with symbols in order and no overlap', () => {
    for (const [name, kinds] of Object.entries(AUX_KINDS)) {
      const lay = layoutBranch(kinds, 46, 300);
      expect(lay.items.map((i) => i.kind), name).toEqual([...kinds]);
      expect(lay.wires, name).toHaveLength(kinds.length + 1);
      let prev = 46;
      lay.items.forEach((it, i) => {
        expect(it.y1 - it.y0, `${name} ${it.kind} height`).toBe(KIND_H[it.kind]);
        expect(it.y0, `${name} gap before ${it.kind}`).toBeGreaterThanOrEqual(prev + 6);
        expect(lay.wires[i], `${name} wire ${i}`).toEqual([prev, it.y0]);
        prev = it.y1;
      });
      expect(lay.wires[kinds.length]).toEqual([prev, 300]);
      expect(prev).toBeLessThanOrEqual(300 - 6);
    }
    expect(() => layoutBranch(['coil', 'coil', 'coil', 'coil'], 0, 300)).toThrow(RangeError);
  });

  it('sloshing dots stay on their wire for every phase and amplitude, and a bigger current swings further', () => {
    const seg = { x1: 470, y1: 46, x2: 470, y2: 120 };
    for (let k = 0; k < 24; k++) {
      for (const dot of sloshDots(seg, 15, 50, (k * Math.PI) / 12)) {
        expect(dot.x).toBe(470);
        expect(dot.y).toBeGreaterThanOrEqual(46);
        expect(dot.y).toBeLessThanOrEqual(120);
      }
    }
    const at = (amp: number) => sloshDots(seg, 15, amp, Math.PI / 2)[0].y;
    expect(Math.abs(at(6) - at(0))).toBeGreaterThan(Math.abs(at(2) - at(0)));
    expect(sloshDots({ x1: 0, y1: 0, x2: 0, y2: 5 }, 15, 5, 1)).toEqual([]); // too short for a dot
    // a phase shift moves the dots, a full cycle does not
    expect(sloshDots(seg, 15, 5, 0.3)[0].y).not.toBeCloseTo(sloshDots(seg, 15, 5, 1.3)[0].y, 3);
    expect(sloshDots(seg, 15, 5, 0.3)[0].y).toBeCloseTo(sloshDots(seg, 15, 5, 0.3 + 2 * Math.PI)[0].y, 9);
  });

  it('wraps phasor angles to (-180, 180] and maps them to screen coordinates', () => {
    expect(angleBetween(0, 82)).toBe(82);
    expect(angleBetween(-41, 41)).toBe(82);
    expect(angleBetween(170, -170)).toBe(20);
    expect(angleBetween(-170, 170)).toBe(-20);
    expect(angleBetween(0, 180)).toBe(180);
    expect(angleBetween(0, -180)).toBe(180);
    const p = polar(100, 100, 50, 90); // counter-clockwise from +x: straight up on the screen
    expect(p.x).toBeCloseTo(100, 9);
    expect(p.y).toBeCloseTo(50, 9);
  });
});
