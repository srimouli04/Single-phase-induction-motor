import { Fragment } from 'react';
import { Detailed } from '../../components/Level';
import { Eq, Rich } from '../../components/Eq';
import { getTerm } from '../../content/glossary';
import { resultText, type Formula, type TryIt } from '../../content/formulas';

interface Props {
  f: Formula;
  onTerm: (id: string) => void;
  onTry: (t: TryIt) => void;
}

/** One formula: the equation, what its symbols mean, when to use it, and a worked example whose numbers come from the model. */
export default function FormulaCard({ f, onTerm, onTry }: Props) {
  const e = f.example;
  const related = (f.related ?? []).filter((id) => getTerm(id));
  return (
    <article className="ref-card" aria-labelledby={`f-${f.id}`}>
      <h4 id={`f-${f.id}`}>{f.name}</h4>
      <Eq block>{f.expr}</Eq>
      <p>{f.use}</p>
      <dl className="ref-symbols">
        {f.symbols.map(([symbol, meaning], i) => (
          <Fragment key={`${symbol}-${i}`}>
            <dt>
              <Eq>{symbol}</Eq>
            </dt>
            <dd>{meaning}</dd>
          </Fragment>
        ))}
      </dl>
      {f.note && (
        <Detailed>
          <p>{f.note}</p>
        </Detailed>
      )}
      {e && (
        <div className="ref-example">
          <p className="ref-example-title">
            Worked example{e.setting && <span className="ref-setting"> · {e.setting}</span>}
          </p>
          <p className="ref-given">
            <span className="muted">Given: </span>
            {e.given.map(([symbol, value], i) => (
              <span key={`${symbol}-${i}`}>
                <Eq>{symbol}</Eq> = {value}
                {i < e.given.length - 1 ? ', ' : ''}
              </span>
            ))}
          </p>
          <p className="ref-working">
            <Eq>{e.working}</Eq> <strong>= {resultText(e)}</strong>
          </p>
          {e.remark && <p className="muted small">{e.remark}</p>}
        </div>
      )}
      {(related.length > 0 || f.tryIt) && (
        <div className="ref-links">
          {related.length > 0 && (
            <span className="small">
              <span className="muted">Glossary: </span>
              {related.map((id, i) => (
                <Fragment key={id}>
                  {i > 0 && ', '}
                  <button type="button" className="link" onClick={() => onTerm(id)}>
                    <Rich>{getTerm(id)?.term ?? id}</Rich>
                  </button>
                </Fragment>
              ))}
            </span>
          )}
          {f.tryIt && (
            <button type="button" className="btn btn-sm" onClick={() => onTry(f.tryIt!)}>
              Try it: {f.tryIt.label} →
            </button>
          )}
        </div>
      )}
    </article>
  );
}
