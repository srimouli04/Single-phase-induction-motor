// Marking the quiz. Pure functions, so they are tested without a browser.
import { TOPICS, type Question, type TopicId } from './quiz';

/** What the student gave: an option index (single), option indices (multi) or the text typed (numeric). */
export type Answer = number | number[] | string;

export interface Verdict {
  correct: boolean;
  /** Why the answer could not be judged at all. */
  problem?: 'blank' | 'not-a-number';
}

/**
 * Reads a typed number: "1800", "1,800", "1.8", "-0.5", "2e3". No units, and no decimal comma (it would be
 * read as a thousands separator by half of the world), so anything else is rejected rather than guessed at.
 */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\s+/g, '').replace('−', '-'); // a typed or pasted minus sign (U+2212)
  if (/^[-+]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) return Number(t.replace(/,/g, ''));
  if (/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return Number(t);
  return null;
}

export function evaluateAnswer(q: Question, a: Answer | null | undefined): Verdict {
  switch (q.type) {
    case 'single':
      return typeof a === 'number' ? { correct: a === q.correct } : { correct: false, problem: 'blank' };
    case 'multi': {
      if (!Array.isArray(a) || a.length === 0) return { correct: false, problem: 'blank' };
      const got = new Set(a);
      return { correct: got.size === q.correct.length && q.correct.every((i) => got.has(i)) }; // all or nothing
    }
    case 'numeric': {
      if (typeof a !== 'string' || a.trim() === '') return { correct: false, problem: 'blank' };
      const x = parseNumber(a);
      if (x === null) return { correct: false, problem: 'not-a-number' };
      return { correct: Math.abs(x - q.answer) <= q.tolerance + 1e-9 };
    }
  }
}

/** The right answer in words, for the feedback and the review. */
export function correctAnswerText(q: Question): string {
  if (q.type === 'single') return q.options[q.correct];
  if (q.type === 'multi') return q.correct.map((i) => q.options[i]).join('; ');
  return `${q.answer} ${q.unit} (anything within ±${q.tolerance} ${q.unit} is accepted)`;
}

export interface TopicScore {
  topic: TopicId;
  label: string;
  correct: number;
  total: number;
}
export interface Tally {
  score: number;
  total: number;
  byTopic: TopicScore[];
}

/** Score for a set of questions: a question counts only if its id is in `correctIds`. Topics keep their usual order. */
export function tally(questions: readonly Question[], correctIds: ReadonlySet<string>): Tally {
  const byTopic: TopicScore[] = [];
  for (const topic of Object.keys(TOPICS) as TopicId[]) {
    const qs = questions.filter((q) => q.topic === topic);
    if (qs.length > 0) byTopic.push({ topic, label: TOPICS[topic], correct: qs.filter((q) => correctIds.has(q.id)).length, total: qs.length });
  }
  return { score: byTopic.reduce((n, t) => n + t.correct, 0), total: questions.length, byTopic };
}
