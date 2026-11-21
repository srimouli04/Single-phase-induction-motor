import { useRef } from 'react';
import { ModelBadge } from '../components/Badges';
import { Page } from '../components/Page';
import { EXPERIMENTS, EXPERIMENT_BY_ID, type Opener, type OptionId } from '../content/experiments';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useApp } from '../state';
import ExperimentView, { FRESH } from './experiments/ExperimentView';

const FLOW = [
  ['Predict', 'Read the question and choose what you expect. A wrong guess teaches more than a lucky one.'],
  ['Run', 'Open the lab, the field section or the fault simulator with the settings already loaded, and try it yourself.'],
  ['Observe', 'Once you have committed to a prediction, a table shows what the model gives for every configuration.'],
  ['Explain', 'Read why it happens and the one-line takeaway. Press “Try again” to repeat an experiment.'],
] as const;

export default function Experiments() {
  const { navigate, progress, markExperiment, setPrediction } = useApp();
  const [selId, setSelId] = useLocalStorage('splm.expSelected', EXPERIMENTS[0].id); // so coming back from the lab lands on the same experiment
  const detail = useRef<HTMLDivElement>(null);

  const exp = EXPERIMENT_BY_ID[selId] ?? EXPERIMENTS[0];
  const answer = progress.predictions?.[exp.id] ?? FRESH;
  const done = new Set(progress.experiments);
  const nDone = EXPERIMENTS.filter((e) => done.has(e.id)).length;

  const pick = (id: string) => {
    setSelId(id);
    const top = detail.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.5) detail.current?.scrollIntoView({ block: 'start' }); // bring the new experiment into view when the list is far above it
  };
  const choose = (o: OptionId) => setPrediction(exp.id, { choice: o, phase: 'predict' });
  const check = () => {
    if (answer.choice === null) return;
    setPrediction(exp.id, { choice: answer.choice, phase: 'checked' });
    markExperiment(exp.id);
  };
  const skip = () => setPrediction(exp.id, { choice: answer.choice, phase: 'skipped' });
  const retry = () => setPrediction(exp.id, FRESH);
  const open = (o: Opener) => navigate(o.target, o.handoff);

  return (
    <Page id="experiments">
      <ModelBadge kinds={['numerical', 'analytical']}>
        Every number in the result tables comes from the same model as the Physics lab (experiment 1 uses the idealised field model of Section 3). They are estimates for an example motor, not measurements.
      </ModelBadge>

      <section className="panel" aria-labelledby="ex-intro">
        <div className="panel-head">
          <h2 id="ex-intro">Predict first, then look</h2>
          <div className="exp-progress">
            <progress max={EXPERIMENTS.length} value={nDone} aria-label="Experiments completed" />
            <span>
              {nDone} of {EXPERIMENTS.length} completed
            </span>
          </div>
        </div>
        <ol className="exp-flow">
          {FLOW.map(([name, text]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <p className="muted small">An experiment counts as completed when you check a prediction. Showing the results without predicting does not count.</p>
      </section>

      <div className="exp-layout">
        <nav className="exp-list" aria-label="Experiments">
          <ol>
            {EXPERIMENTS.map((e, i) => (
              <li key={e.id}>
                <button type="button" className="exp-pick" aria-current={e.id === exp.id ? 'true' : undefined} onClick={() => pick(e.id)}>
                  <span className="num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span className="exp-pick-text">
                    <span className="exp-pick-title">{e.title}</span>
                    <span className="exp-level">{e.level}</span>
                  </span>
                  {done.has(e.id) && (
                    <span className="exp-done">
                      <span aria-hidden="true">✓</span>
                      <span className="sr-only">completed</span>
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div ref={detail} className="exp-detail">
          <ExperimentView exp={exp} answer={answer} onChoose={choose} onCheck={check} onSkip={skip} onRetry={retry} onOpen={open} />
        </div>
      </div>
    </Page>
  );
}
