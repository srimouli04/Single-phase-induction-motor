import { useEffect, useId, useRef, useState } from 'react';
import { SECTION_BY_ID, type SectionId } from '../../content/sections';
import { TOPICS, type Question } from '../../content/quiz';
import { correctAnswerText, evaluateAnswer, type Answer, type Verdict } from '../../content/quizScoring';
import { Rich } from '../../components/Eq';

/** A question that has been marked (or whose answer was shown). */
export interface Checked extends Verdict {
  gaveUp: boolean;
}

interface Props {
  q: Question;
  n: number;
  of: number;
  answer: Answer | undefined;
  checked: Checked | undefined;
  onAnswer: (a: Answer) => void;
  onCheck: () => void;
  onGiveUp: () => void;
  onNext: () => void;
  onReview: (id: SectionId) => void;
}

const LETTERS = 'abcdefgh';

/** What to say next to an option once the question has been marked. */
function tag(multi: boolean, picked: boolean, right: boolean): string {
  if (right) return picked ? (multi ? '✔ Correct choice' : '✔ Right answer, your choice') : multi ? '✔ Part of the answer (you missed it)' : '✔ Right answer';
  return picked ? (multi ? '✖ Not part of the answer' : '✖ Your answer') : '';
}

/** One question: answer it, ask for a hint, check it, read the feedback. The parent keys it by question, so its state starts fresh each time. */
export default function QuestionCard({ q, n, of, answer, checked, onAnswer, onCheck, onGiveUp, onNext, onReview }: Props) {
  const promptId = useId();
  const unitId = useId();
  const hintId = useId();
  const head = useRef<HTMLHeadingElement>(null);
  const note = useRef<HTMLDivElement>(null);
  const [hint, setHint] = useState(false);

  const locked = checked !== undefined;
  const v = evaluateAnswer(q, answer);
  const canCheck = !locked && v.problem === undefined;
  const last = n === of;

  useEffect(() => head.current?.focus(), []); // a new question: start reading at its heading
  useEffect(() => {
    if (checked) note.current?.focus(); // the Check button is replaced by feedback, so move focus there
  }, [checked]);

  const toggle = (i: number) => {
    if (q.type === 'single') return onAnswer(i);
    const cur = Array.isArray(answer) ? answer : [];
    onAnswer(cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b));
  };

  return (
    <section className="panel quiz-card" aria-labelledby={`${promptId}-h`}>
      <h2 id={`${promptId}-h`} ref={head} tabIndex={-1}>
        Question {n} of {of}
      </h2>
      <p className="quiz-meta">
        {TOPICS[q.topic]} · {q.level}
      </p>
      <p id={promptId} className="quiz-prompt">
        <Rich>{q.prompt}</Rich>
      </p>

      {q.type === 'numeric' ? (
        <div className="quiz-numeric">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            aria-labelledby={`${promptId} ${unitId}`}
            value={typeof answer === 'string' ? answer : ''}
            disabled={locked}
            onChange={(e) => onAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCheck) onCheck();
            }}
          />
          <span id={unitId} className="unit">
            {q.unit}
          </span>
        </div>
      ) : (
        <fieldset className="choices" disabled={locked} aria-labelledby={promptId}>
          {q.options.map((text, i) => {
            const multi = q.type === 'multi';
            const picked = multi ? Array.isArray(answer) && answer.includes(i) : answer === i;
            const right = multi ? q.correct.includes(i) : q.correct === i;
            const mark = locked ? (right ? ' right' : picked ? ' wrong' : '') : '';
            return (
              <label key={text} className={`choice${picked ? ' on' : ''}${mark}`}>
                <input type={multi ? 'checkbox' : 'radio'} name={promptId} checked={picked} onChange={() => toggle(i)} />
                <span className="opt-id" aria-hidden="true">
                  {LETTERS[i]}
                </span>
                <span>
                  <Rich>{text}</Rich>
                  {locked && tag(multi, picked, right) && <strong className="opt-tag"> {tag(multi, picked, right)}</strong>}
                </span>
              </label>
            );
          })}
        </fieldset>
      )}
      {!locked && q.type === 'multi' && <p className="muted small">Select every option that applies. The question is marked all or nothing, so the set you choose must be exactly right.</p>}
      {!locked && q.type === 'numeric' && (
        <p className={v.problem === 'not-a-number' ? 'ctl-warn' : 'muted small'} role="status">
          {v.problem === 'not-a-number' ? 'Enter just a number, such as 1800 or 1.8. Use a point for decimals; the unit is already shown.' : `Type a number in ${q.unit}. A calculator is fine.`}
        </p>
      )}

      {!locked && (
        <div className="quiz-hint">
          <button type="button" className="btn btn-sm btn-ghost" aria-expanded={hint} aria-controls={hintId} onClick={() => setHint((h) => !h)}>
            {hint ? 'Hide hint' : 'Show hint'}
          </button>
          <p id={hintId} className="quiz-hint-text" hidden={!hint}>
            <strong>Hint:</strong> <Rich>{q.hint}</Rich>
          </p>
        </div>
      )}

      {locked ? (
        <>
          <div ref={note} tabIndex={-1} role="status" className={`feedback${checked.correct ? '' : checked.gaveUp ? ' info' : ' bad'}`}>
            <strong>{checked.correct ? '✔ Correct' : checked.gaveUp ? 'Answer shown (counted as missed)' : '✖ Not quite'}</strong>
            {!checked.correct && (
              <p>
                <strong>Right answer:</strong> <Rich>{correctAnswerText(q)}</Rich>
              </p>
            )}
            {!checked.correct && !checked.gaveUp && q.type === 'numeric' && typeof answer === 'string' && (
              <p>
                You entered {answer.trim()} {q.unit}.
              </p>
            )}
            <p>
              <Rich>{q.explain}</Rich>
            </p>
            {!checked.correct && (
              <button type="button" className="link" onClick={() => onReview(q.review)}>
                Review Section {SECTION_BY_ID[q.review].number}: {SECTION_BY_ID[q.review].title} →
              </button>
            )}
          </div>
          <div className="row quiz-actions">
            <button type="button" className="btn btn-primary" onClick={onNext}>
              {last ? 'See my results →' : 'Next question →'}
            </button>
          </div>
        </>
      ) : (
        <div className="row quiz-actions">
          <button type="button" className="btn btn-primary" disabled={!canCheck} onClick={onCheck}>
            Check answer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onGiveUp}>
            Show the answer
          </button>
        </div>
      )}
    </section>
  );
}
