import { useEffect, useRef } from 'react';
import { Rich } from '../../components/Eq';
import { SECTION_BY_ID, type SectionId } from '../../content/sections';
import { QUESTIONS, type Question } from '../../content/quiz';
import { correctAnswerText, type Answer, type Tally } from '../../content/quizScoring';
import type { Progress } from '../../state';
import type { Checked } from './QuestionCard';

interface Props {
  questions: Question[];
  answers: Record<string, Answer>;
  checked: Record<string, Checked>;
  result: Tally;
  /** True when every question was asked, so the score counts towards the best result. */
  full: boolean;
  best: Progress['quiz'];
  onRetryMissed: () => void;
  onRestart: () => void;
  onOpen: (id: SectionId) => void;
}

function message(pct: number): string {
  if (pct === 100) return 'A perfect score.';
  if (pct >= 80) return 'A strong result. Read the explanations for the few you missed, then test the details in the experiments and the fault simulator.';
  if (pct >= 50) return 'A reasonable start. The topic table shows where to look again.';
  return 'Plenty to revisit, which is what a first attempt is for. Follow the review links below, then try again.';
}

/** What the student answered, in words, for the review of a missed question. */
function givenText(q: Question, a: Answer | undefined, gaveUp: boolean): string {
  if (gaveUp || a === undefined) return 'Answer shown without trying';
  if (q.type === 'single') return typeof a === 'number' ? q.options[a] : '–';
  if (q.type === 'multi') return Array.isArray(a) && a.length > 0 ? a.map((i) => q.options[i]).join('; ') : '–';
  return typeof a === 'string' ? `${a.trim()} ${q.unit}` : '–';
}

export default function Results({ questions, answers, checked, result, full, best, onRetryMissed, onRestart, onOpen }: Props) {
  const head = useRef<HTMLHeadingElement>(null);
  useEffect(() => head.current?.focus(), []);
  const pct = Math.round((100 * result.score) / result.total);
  const missed = questions.filter((q) => !checked[q.id]?.correct);

  return (
    <>
      <section className="panel" aria-labelledby="qr-h">
        <h2 id="qr-h" ref={head} tabIndex={-1}>
          {full ? 'Your result' : 'Result for the questions you retried'}
        </h2>
        <p className="score-big" aria-label={`${result.score} out of ${result.total}, ${pct} percent`}>
          {result.score} <span>/ {result.total}</span> <small>{pct} %</small>
        </p>
        <p>{message(pct)}</p>
        {full && best && (
          <p className="muted small">
            Best so far: {best.best} of {best.total} · attempts: {best.attempts}
          </p>
        )}
        {!full && <p className="muted small">This retry is not added to your best score. Only a full attempt at all {QUESTIONS.length} questions is.</p>}

        <h3>Score by topic</h3>
        <div className="table-wrap">
          <table className="data topic-table">
            <caption className="sr-only">Score by topic</caption>
            <thead>
              <tr>
                <th scope="col">Topic</th>
                <th scope="col">Correct</th>
                <th scope="col">Where to look again</th>
              </tr>
            </thead>
            <tbody>
              {result.byTopic.map((t) => {
                const firstMissed = questions.find((q) => q.topic === t.topic && !checked[q.id]?.correct);
                return (
                  <tr key={t.topic}>
                    <th scope="row">{t.label}</th>
                    <td>
                      <span className="topic-bar" aria-hidden="true">
                        <span style={{ width: `${(100 * t.correct) / t.total}%` }} />
                      </span>
                      <span className="topic-count">
                        {t.correct} of {t.total}
                      </span>
                    </td>
                    <td>
                      {firstMissed ? (
                        <button type="button" className="link" onClick={() => onOpen(firstMissed.review)}>
                          Section {SECTION_BY_ID[firstMissed.review].number}: {SECTION_BY_ID[firstMissed.review].title}
                        </button>
                      ) : (
                        <span className="muted">Nothing to review ✔</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="row quiz-actions">
          {missed.length > 0 && (
            <button type="button" className="btn btn-primary" onClick={onRetryMissed}>
              Retry the {missed.length} I missed
            </button>
          )}
          <button type="button" className={`btn${missed.length === 0 ? ' btn-primary' : ''}`} onClick={onRestart}>
            Start again
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onOpen('reference')}>
            Open the formulas and glossary →
          </button>
        </div>
      </section>

      {missed.length > 0 && (
        <section className="panel" aria-labelledby="qm-h">
          <h2 id="qm-h">Review of the {missed.length === 1 ? 'question' : `${missed.length} questions`} you missed</h2>
          <ol className="missed">
            {missed.map((q) => (
              <li key={q.id}>
                <p>
                  <strong>
                    <Rich>{q.prompt}</Rich>
                  </strong>
                </p>
                <p>
                  <span className="muted">Your answer:</span> <Rich>{givenText(q, answers[q.id], checked[q.id]?.gaveUp ?? false)}</Rich>
                </p>
                <p>
                  <span className="muted">Right answer:</span> <Rich>{correctAnswerText(q)}</Rich>
                </p>
                <p>
                  <Rich>{q.explain}</Rich>
                </p>
                <button type="button" className="link" onClick={() => onOpen(q.review)}>
                  Review Section {SECTION_BY_ID[q.review].number}: {SECTION_BY_ID[q.review].title} →
                </button>
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
