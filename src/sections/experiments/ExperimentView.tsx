import { useEffect, useMemo, useRef } from 'react';
import { ResetButton } from '../../components/Controls';
import { Eq, Rich } from '../../components/Eq';
import { Detailed } from '../../components/Level';
import { EXPERIMENTS, measureExperiment, type Experiment, type Opener, type OptionId } from '../../content/experiments';
import { METRICS, formatMetric } from '../../simulations/experiments';
import type { Prediction } from '../../state';

export const FRESH: Prediction = { choice: null, phase: 'predict' };

interface Props {
  exp: Experiment;
  answer: Prediction;
  onChoose: (o: OptionId) => void;
  onCheck: () => void;
  onSkip: () => void;
  onRetry: () => void;
  onOpen: (o: Opener) => void;
}

/** One experiment: predict, run it elsewhere, then (once committed) observe the model's numbers and read the explanation. */
export default function ExperimentView({ exp, answer, onChoose, onCheck, onSkip, onRetry, onOpen }: Props) {
  const n = EXPERIMENTS.indexOf(exp) + 1;
  const revealed = answer.phase !== 'predict';
  const rows = useMemo(() => (revealed ? measureExperiment(exp) : []), [exp, revealed]); // measured only once there is something to show
  const chosen = exp.options.find((o) => o.id === answer.choice);
  const right = exp.options.find((o) => o.id === exp.correct)!;
  const correct = answer.choice === exp.correct;
  const hasGap = rows.some((r) => exp.columns.some((c) => r.v[c] === null));

  // The button that revealed the results disappears, so hand keyboard focus to the feedback that replaces it.
  const note = useRef<HTMLDivElement>(null);
  const was = useRef({ id: exp.id, revealed });
  useEffect(() => {
    if (was.current.id === exp.id && !was.current.revealed && revealed) note.current?.focus();
    was.current = { id: exp.id, revealed };
  }, [exp.id, revealed]);

  return (
    <section className="panel exp-view" aria-labelledby="exp-h">
      <div className="panel-head">
        <div>
          <p className="eyebrow">
            Experiment {n} of {EXPERIMENTS.length} · {exp.level}
          </p>
          <h2 id="exp-h">{exp.title}</h2>
        </div>
        <ResetButton label="Try again" onClick={onRetry} />
      </div>
      <p>{exp.goal}</p>
      <p className="muted small">
        <strong>Held constant:</strong> {exp.setup}
      </p>

      <h3>1 · Predict</h3>
      <fieldset className="choices" disabled={revealed}>
        <legend>{exp.question}</legend>
        {exp.options.map((o) => {
          const mark = revealed && o.id === exp.correct ? ' right' : revealed && o.id === answer.choice ? ' wrong' : '';
          return (
            <label key={o.id} className={`choice${o.id === answer.choice ? ' on' : ''}${mark}`}>
              <input type="radio" name={`exp-${exp.id}`} value={o.id} checked={o.id === answer.choice} onChange={() => onChoose(o.id)} />
              <span className="opt-id" aria-hidden="true">
                {o.id}
              </span>
              <span>
                {o.text}
                {revealed && o.id === exp.correct && <strong className="opt-tag"> ✔ Right answer</strong>}
                {revealed && o.id === answer.choice && o.id !== exp.correct && <strong className="opt-tag"> ✖ Your answer</strong>}
              </span>
            </label>
          );
        })}
      </fieldset>
      {!revealed && (
        <div className="row">
          <button type="button" className="btn btn-primary" disabled={answer.choice === null} onClick={onCheck}>
            Check my prediction
          </button>
          <button type="button" className="btn btn-ghost" onClick={onSkip}>
            Show the results without predicting
          </button>
        </div>
      )}
      {answer.phase === 'checked' && chosen && (
        <div ref={note} tabIndex={-1} className={`feedback${correct ? '' : ' bad'}`} role="status">
          <strong>{correct ? '✔ Correct' : '✖ Not quite'}</strong>
          <p>{chosen.why}</p>
          {!correct && (
            <p>
              The right answer is <strong>({right.id})</strong>. {right.why}
            </p>
          )}
        </div>
      )}
      {answer.phase === 'skipped' && (
        <div ref={note} tabIndex={-1} className="feedback info" role="status">
          Results shown without a prediction. Press “Try again” to predict first; it counts as completed only when you do.
        </div>
      )}

      <h3>2 · Run it</h3>
      {!revealed && answer.choice === null && <p className="muted small">Choose a prediction first, then run it yourself.</p>}
      <ol className="steps">
        {exp.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="row">
        {exp.open.map((o, i) => (
          <button key={o.label} type="button" className={`btn${i === 0 ? ' btn-primary' : ''}`} onClick={() => onOpen(o)}>
            {o.label} →
          </button>
        ))}
      </div>

      {revealed ? (
        <>
          <h3>3 · Observe</h3>
          <p className="muted small">What the model gives for each configuration. These are the same numbers you will read in the {exp.open[0].target === 'field' ? 'field section' : 'Physics lab'}.</p>
          <div className="table-wrap">
            <table className="data exp-table">
              <caption className="sr-only">Results of experiment {n}</caption>
              <thead>
                <tr>
                  <th scope="col">Configuration</th>
                  {exp.columns.map((c) => (
                    <th key={c} scope="col" className={c === 'outcome' ? undefined : 'r'}>
                      {METRICS[c].label}
                      {METRICS[c].unit && <small> ({METRICS[c].unit})</small>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {exp.columns.map((c) => (
                      <td key={c} className={c === 'outcome' ? undefined : 'r'}>
                        {formatMetric(c, r.v[c])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasGap && <p className="muted small">A dash means the value is not meaningful for that run (for example, a motor that keeps cycling has no steady speed).</p>}
          <h4>What you should see</h4>
          <ul className="claims">
            {exp.claims.map((c) => (
              <li key={c.text}>{c.text}</li>
            ))}
          </ul>

          <h3>4 · Explain</h3>
          <p>{exp.why}</p>
          <p className="exp-takeaway">
            <strong>Takeaway:</strong> {exp.takeaway}
          </p>
          {exp.detail && (
            <Detailed>
              <Eq block>{exp.detail.eq}</Eq>
              <p className="muted small">
                <Rich>{exp.detail.note}</Rich>
              </p>
            </Detailed>
          )}
        </>
      ) : (
        <p className="muted small">Steps 3 and 4 (the numbers and the explanation) appear once you have made a prediction.</p>
      )}
    </section>
  );
}
