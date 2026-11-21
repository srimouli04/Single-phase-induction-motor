import { describe, expect, it } from 'vitest';
import { SECTIONS, SECTION_BY_ID, STAGES } from '../content/sections';
import { summarize, turnsInReverse } from '../simulations/metrics';
import { DEFAULT_INPUTS } from '../simulations/motorModel';

describe('section order', () => {
  it('numbers the sections 1..n in list order and always suggests the following one next', () => {
    SECTIONS.forEach((s, i) => {
      expect(s.number, s.id).toBe(i + 1);
      expect(s.next, s.id).toBe(SECTIONS[i + 1]?.id);
    });
  });

  it('moves through the learning stages in order, each entered at a section that belongs to it', () => {
    const stages = SECTIONS.filter((s) => s.stage >= 0).map((s) => s.stage);
    expect(stages).toEqual([...stages].sort((a, b) => a - b));
    STAGES.forEach((st, i) => expect(SECTION_BY_ID[st.entry].stage, st.label).toBe(i));
  });
});

describe('reverse running', () => {
  it('is reported only for a motor that actually turns against its normal direction', () => {
    const fwd = summarize(DEFAULT_INPUTS);
    const rev = summarize({ ...DEFAULT_INPUTS, auxReversed: true });
    expect(turnsInReverse(fwd)).toBe(false);
    expect(turnsInReverse(rev)).toBe(true);
    expect(rev.startTorque).toBeLessThan(0);
    expect(rev.run.torqueNet).toBeLessThan(0); // the operating point lies on the negative-speed side of the torque curve
    expect(turnsInReverse(summarize({ ...DEFAULT_INPUTS, method: 'main-only' }))).toBe(false); // hums, never turns
  });
});
