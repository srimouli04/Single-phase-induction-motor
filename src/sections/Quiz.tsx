import { useState } from 'react';
import { ResetButton } from '../components/Controls';
import { Page } from '../components/Page';
import { QUESTIONS, TOPICS, type Question } from '../content/quiz';
import { evaluateAnswer, tally, type Answer } from '../content/quizScoring';
import { useApp } from '../state';
import QuestionCard, { type Checked } from './quiz/QuestionCard';
import Results from './quiz/Results';

type Phase = 'intro' | 'asking' | 'results';

const correctIds = (c: Record<string, Checked>): Set<string> => new Set(Object.keys(c).filter((id) => c[id].correct));

export default function Quiz() {
  const { navigate, progress, recordQuiz } = useApp();
  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState<Question[]>(QUESTIONS); // the questions of this attempt: all of them, or only the ones missed
  const [at, setAt] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [checked, setChecked] = useState<Record<string, Checked>>({});

  const begin = (qs: Question[]) => {
    setRun(qs);
    setAt(0);
    setAnswers({});
    setChecked({});
    setPhase('asking');
  };
  const q = run[at];

  const check = () => {
    const v = evaluateAnswer(q, answers[q.id]);
    if (!v.problem) setChecked((c) => ({ ...c, [q.id]: { ...v, gaveUp: false } }));
  };
  const giveUp = () => setChecked((c) => ({ ...c, [q.id]: { correct: false, gaveUp: true } }));
  const next = () => {
    if (at + 1 < run.length) return setAt(at + 1);
    if (run.length === QUESTIONS.length) {
      const t = tally(run, correctIds(checked));
      recordQuiz(t.score, t.total); // a retry of a few questions is not comparable with a full attempt, so it is not recorded
    }
    setPhase('results');
  };

  const best = progress.quiz;
  const byTopic = Object.entries(TOPICS).map(([id, label]) => ({ id, label, n: QUESTIONS.filter((x) => x.topic === id).length }));

  return (
    <Page id="quiz">
      {phase === 'intro' && (
        <section className="panel" aria-labelledby="qi-h">
          <h2 id="qi-h">Check what you have learned</h2>
          <p>
            {QUESTIONS.length} questions on {byTopic.length} topics. Some ask you to choose one answer, some to select every answer that applies (marked all or nothing), and some to type a number. You get feedback after each question, and a hint if you want one. Nothing is timed, and
            you can start over at any point.
          </p>
          <ul className="quiz-topics">
            {byTopic.map((t) => (
              <li key={t.id}>
                {t.label} <span className="muted">({t.n})</span>
              </li>
            ))}
          </ul>
          {best && (
            <p className="muted">
              Your best so far: {best.best} of {best.total} · attempts: {best.attempts}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => begin(QUESTIONS)}>
              {best ? 'Take the quiz again' : 'Start the quiz'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('reference')}>
              Look something up first →
            </button>
          </div>
        </section>
      )}

      {phase === 'asking' && q && (
        <>
          <div className="quiz-top">
            <progress max={run.length} value={at + (checked[q.id] ? 1 : 0)} aria-label="Quiz progress" />
            <ResetButton
              label="Start over"
              onClick={() => {
                setPhase('intro');
                setRun(QUESTIONS);
              }}
            />
          </div>
          <QuestionCard
            key={q.id}
            q={q}
            n={at + 1}
            of={run.length}
            answer={answers[q.id]}
            checked={checked[q.id]}
            onAnswer={(a) => setAnswers((x) => ({ ...x, [q.id]: a }))}
            onCheck={check}
            onGiveUp={giveUp}
            onNext={next}
            onReview={navigate}
          />
        </>
      )}

      {phase === 'results' && (
        <Results
          questions={run}
          answers={answers}
          checked={checked}
          result={tally(run, correctIds(checked))}
          full={run.length === QUESTIONS.length}
          best={best}
          onRetryMissed={() => begin(run.filter((x) => !checked[x.id]?.correct))}
          onRestart={() => begin(QUESTIONS)}
          onOpen={navigate}
        />
      )}
    </Page>
  );
}
