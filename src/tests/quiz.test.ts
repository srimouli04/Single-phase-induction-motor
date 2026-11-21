import { describe, expect, it } from 'vitest';
import { QUESTIONS, TOPICS, type NumericQuestion, type TopicId } from '../content/quiz';
import { correctAnswerText, evaluateAnswer, parseNumber, tally } from '../content/quizScoring';
import { SECTION_BY_ID, isSectionId } from '../content/sections';
import { torqueIndex } from '../simulations/field';
import { lineCurrent, summarize } from '../simulations/metrics';
import { DEFAULT_INPUTS, EXAMPLE_MOTOR, electricalFor, rotorSpeedFromSlip, slipFromSpeeds, solveAtSpeed, syncOmega, synchronousSpeedRpm } from '../simulations/motorModel';
import { compareMethods } from '../simulations/starting';

const byId = (id: string) => {
  const q = QUESTIONS.find((x) => x.id === id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
};
const numeric = (id: string): NumericQuestion => {
  const q = byId(id);
  if (q.type !== 'numeric') throw new Error(`${id} is not numeric`);
  return q;
};
const NUMBER_WORDS = ['Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];

describe('quiz content', () => {
  it('has the number of questions the section blurb announces, each with its own id', () => {
    expect(QUESTIONS.length).toBeGreaterThanOrEqual(15);
    expect(SECTION_BY_ID.quiz.blurb).toContain(NUMBER_WORDS[QUESTIONS.length - 15]);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(QUESTIONS.length);
    expect(new Set(QUESTIONS.map((q) => q.prompt)).size).toBe(QUESTIONS.length);
  });

  it('covers every topic at least twice and uses all three kinds of question', () => {
    for (const topic of Object.keys(TOPICS) as TopicId[]) expect(QUESTIONS.filter((q) => q.topic === topic).length, topic).toBeGreaterThanOrEqual(2);
    for (const type of ['single', 'multi', 'numeric']) expect(QUESTIONS.some((q) => q.type === type), type).toBe(true);
  });

  it('is well formed, question by question', () => {
    for (const q of QUESTIONS) {
      expect(q.topic in TOPICS, `${q.id} topic`).toBe(true);
      expect(isSectionId(q.review), `${q.id} review`).toBe(true);
      expect(q.prompt.length, `${q.id} prompt`).toBeGreaterThan(20);
      expect(q.hint.length, `${q.id} hint`).toBeGreaterThan(15);
      expect(q.explain.length, `${q.id} explanation`).toBeGreaterThan(q.type === 'numeric' ? 40 : 80); // a worked calculation can be short
      if (q.type === 'numeric') {
        expect(Number.isFinite(q.answer), `${q.id} answer`).toBe(true);
        expect(q.tolerance, `${q.id} tolerance`).toBeGreaterThan(0);
        expect(q.unit.length, `${q.id} unit`).toBeGreaterThan(0);
        continue;
      }
      expect(new Set(q.options.map((o) => o.trim())).size, `${q.id} options are distinct`).toBe(q.options.length);
      expect(q.options.length, `${q.id} options`).toBeGreaterThanOrEqual(4);
      const right = q.type === 'single' ? [q.correct] : q.correct;
      for (const i of right) expect(Number.isInteger(i) && i >= 0 && i < q.options.length, `${q.id} correct index ${i}`).toBe(true);
      if (q.type === 'multi') {
        expect(right.every((i, k) => k === 0 || i > right[k - 1]), `${q.id} correct is sorted and unique`).toBe(true);
        expect(right.length, `${q.id} number correct`).toBeGreaterThanOrEqual(2);
        expect(right.length, `${q.id} leaves a wrong option`).toBeLessThan(q.options.length);
      }
    }
  });

  it('does not always put the right answer in the same place', () => {
    const positions = QUESTIONS.flatMap((q) => (q.type === 'single' ? [q.correct] : []));
    expect(new Set(positions).size).toBeGreaterThanOrEqual(3);
  });
});

describe('numeric answers agree with the model', () => {
  it('phase shift: starting torque goes with sin φ of the ideal', () => {
    const pct = 100 * Math.abs(torqueIndex({ imAmp: 1, iaAmp: 1, phaseDeg: 30, axisDeg: 90 }));
    expect(numeric('phase-shift-torque').answer).toBeCloseTo(pct, 6);
  });
  it('synchronous speed, 4 poles on 60 Hz', () => {
    expect(numeric('sync-speed').answer).toBe(synchronousSpeedRpm(60, 4));
  });
  it('slip, 6 poles on 50 Hz at 960 rpm', () => {
    expect(numeric('slip').answer).toBeCloseTo(100 * slipFromSpeeds(synchronousSpeedRpm(50, 6), 960), 9);
  });
  it('rotor-current frequency at 3 % slip', () => {
    const rpm = rotorSpeedFromSlip(synchronousSpeedRpm(60, 4), 0.03);
    expect(numeric('rotor-frequency').answer).toBeCloseTo(slipFromSpeeds(synchronousSpeedRpm(60, 4), rpm) * 60, 9);
  });
  it('starting torque at 96 V against 120 V, within the stated tolerance', () => {
    const q = numeric('voltage-torque');
    const ratio = summarize({ ...DEFAULT_INPUTS, voltage: 96 }).startTorque / summarize(DEFAULT_INPUTS).startTorque;
    expect(Math.abs(100 * ratio - q.answer)).toBeLessThanOrEqual(q.tolerance);
    expect(DEFAULT_INPUTS.voltage).toBe(120);
  });
});

describe('statements about the example motor hold in the model', () => {
  it('a resistive start winding shifts the phase a little and a capacitor a lot', () => {
    const cmp = compareMethods({ loadTorque: 0.3 });
    const lead = (id: string) => cmp.methods.find((m) => m.id === id)!.start.auxLeadDeg;
    expect(lead('split-phase')).toBeLessThan(30);
    expect(lead('capacitor-start')).toBeGreaterThan(75);
  });

  it('the torque drops when the centrifugal switch opens, at the switch speed of 75 %', () => {
    expect(DEFAULT_INPUTS.cutoutFraction).toBe(0.75);
    const w = DEFAULT_INPUTS.cutoutFraction * syncOmega(DEFAULT_INPUTS.frequencyHz, DEFAULT_INPUTS.poles);
    const torque = (aux: boolean) => solveAtSpeed(EXAMPLE_MOTOR, electricalFor(DEFAULT_INPUTS, EXAMPLE_MOTOR, aux), w).torqueNet;
    expect(torque(true)).toBeGreaterThan(torque(false));
  });

  it('without its start circuit the motor hums at rest, yet keeps running once spun', () => {
    const open = { ...DEFAULT_INPUTS, auxOpen: true };
    expect(summarize(open).startup.outcome).toBe('no-start');
    expect(summarize(open, undefined, { startFraction: 0.4 }).startup.outcome).toBe('settles');
  });

  it('a welded switch lets the motor run, with several times the normal current', () => {
    const normal = summarize(DEFAULT_INPUTS);
    const welded = summarize({ ...DEFAULT_INPUTS, switchFault: 'stuck-closed' });
    expect(welded.startup.outcome).toBe('settles');
    expect(lineCurrent(welded.run)).toBeGreaterThan(3 * lineCurrent(normal.run));
  });
});

describe('parsing a typed number', () => {
  it('reads plain numbers, thousands separators, signs and exponents', () => {
    expect(parseNumber('1800')).toBe(1800);
    expect(parseNumber(' 1,800 ')).toBe(1800);
    expect(parseNumber('1,800.5')).toBe(1800.5);
    expect(parseNumber('1.8')).toBe(1.8);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('-0.5')).toBe(-0.5);
    expect(parseNumber('−0.5')).toBe(-0.5); // the typographic minus sign
    expect(parseNumber('2e3')).toBe(2000);
  });
  it('rejects units, decimal commas, empty and malformed input rather than guessing', () => {
    for (const bad of ['', '   ', '1800 rpm', '4 %', '1,8', '1,80', '12,34,567', '1..8', 'abc', '1e', '--1', '0x10']) expect(parseNumber(bad), `"${bad}"`).toBeNull();
  });
});

describe('marking answers', () => {
  it('marks every question right with its own right answer, and wrong with a clearly wrong one', () => {
    for (const q of QUESTIONS) {
      const right = q.type === 'numeric' ? String(q.answer) : q.type === 'single' ? q.correct : q.correct;
      const wrong = q.type === 'numeric' ? String(q.answer + 2 * q.tolerance + 1) : q.type === 'single' ? (q.correct + 1) % q.options.length : [q.correct[0]];
      expect(evaluateAnswer(q, right).correct, `${q.id} right`).toBe(true);
      expect(evaluateAnswer(q, wrong).correct, `${q.id} wrong`).toBe(false);
    }
  });

  it('treats a missing answer as blank, not as wrong-but-judged', () => {
    for (const q of QUESTIONS) {
      for (const none of [undefined, null, q.type === 'numeric' ? '  ' : q.type === 'multi' ? [] : 'x']) expect(evaluateAnswer(q, none as never), q.id).toEqual({ correct: false, problem: 'blank' });
    }
  });

  it('marks select-all questions all or nothing, in any order', () => {
    const q = byId('stator-parts');
    if (q.type !== 'multi') throw new Error('expected a multi question');
    expect(evaluateAnswer(q, [3, 1, 2]).correct).toBe(true);
    expect(evaluateAnswer(q, [1, 2]).correct).toBe(false); // one missing
    expect(evaluateAnswer(q, [1, 2, 3, 0]).correct).toBe(false); // one extra
    expect(evaluateAnswer(q, [0, 1, 2]).correct).toBe(false); // one swapped
  });

  it('accepts a numeric answer on the edges of its tolerance and not beyond', () => {
    const q = numeric('rotor-frequency'); // 1.8 ± 0.05
    for (const ok of ['1.8', '1.75', '1.85', '1.80']) expect(evaluateAnswer(q, ok).correct, ok).toBe(true);
    for (const no of ['1.7', '1.86', '1.74', '18', '0']) expect(evaluateAnswer(q, no).correct, no).toBe(false);
    expect(evaluateAnswer(q, '1.8 Hz')).toEqual({ correct: false, problem: 'not-a-number' });
    expect(evaluateAnswer(numeric('sync-speed'), '1,800').correct).toBe(true);
  });

  it('describes the right answer in words', () => {
    expect(correctAnswerText(byId('shaded-pole'))).toBe('Shaded-pole');
    expect(correctAnswerText(byId('stator-parts'))).toBe('Laminated iron core; Main winding; Auxiliary (start) winding');
    expect(correctAnswerText(numeric('sync-speed'))).toContain('1800 rpm');
  });
});

describe('scoring', () => {
  it('counts only the questions marked right, by topic in the usual order, and the unanswered as missed', () => {
    const ids = new Set(['supply-connection', 'stator-parts', 'sync-speed']);
    const t = tally(QUESTIONS, ids);
    expect(t.score).toBe(3);
    expect(t.total).toBe(QUESTIONS.length);
    expect(t.byTopic.map((x) => x.topic)).toEqual(Object.keys(TOPICS));
    expect(t.byTopic.find((x) => x.topic === 'parts')).toMatchObject({ correct: 2, total: 3 });
    expect(t.byTopic.find((x) => x.topic === 'speed')).toMatchObject({ correct: 1, total: 3 });
    expect(t.byTopic.reduce((n, x) => n + x.total, 0)).toBe(QUESTIONS.length);
  });

  it('scores a retry of a few questions out of those questions, leaving out topics that were not asked', () => {
    const retry = QUESTIONS.filter((q) => q.topic === 'faults' || q.topic === 'speed');
    const t = tally(retry, new Set(['slip']));
    expect(t.total).toBe(retry.length);
    expect(t.score).toBe(1);
    expect(t.byTopic.map((x) => x.topic)).toEqual(['speed', 'faults']);
  });
});
