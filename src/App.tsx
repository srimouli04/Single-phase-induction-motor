import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { SECTIONS, STAGES, type SectionId } from './content/sections';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Segmented } from './components/Controls';
import { Loading } from './components/Page';
import { useApp } from './state';

const VIEWS: Record<SectionId, LazyExoticComponent<ComponentType>> = {
  overview: lazy(() => import('./sections/Overview')),
  explorer: lazy(() => import('./sections/Explorer')),
  field: lazy(() => import('./sections/FieldSection')),
  starting: lazy(() => import('./sections/Starting')),
  lab: lazy(() => import('./sections/Lab')),
  faults: lazy(() => import('./sections/Faults')),
  experiments: lazy(() => import('./sections/Experiments')),
  quiz: lazy(() => import('./sections/Quiz')),
  reference: lazy(() => import('./sections/Reference')),
};

export default function App() {
  const { section, navigate, prefs, setDetail, togglePaused, motionOn, progress, resetProgress } = useApp();
  const View = VIEWS[section];
  const current = SECTIONS.find((s) => s.id === section)!;
  const visited = new Set(progress.visited);

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <strong>Single-Phase Induction Motor Lab</strong>
            <span className="brand-sub">Interactive engineering textbook</span>
          </div>
        </div>
        <div className="topbar-tools">
          <Segmented
            label="Explanation level"
            value={prefs.detail}
            onChange={setDetail}
            options={[
              { value: 'beginner', label: 'Beginner', title: 'Plain-language explanations' },
              { value: 'detailed', label: 'Detailed', title: 'Adds equations, assumptions and nuance' },
            ]}
          />
          <button className="btn" aria-pressed={!motionOn} onClick={togglePaused} title="Pause or resume all animations (also respects your system reduced-motion setting)">
            {motionOn ? '⏸ Pause animations' : '▶ Animations paused'}
          </button>
        </div>
      </header>

      <aside className="sidebar">
        <nav aria-label="Sections">
          <ol className="path" aria-label="Suggested learning path">
            {STAGES.map((st, i) => {
              const members = SECTIONS.filter((s) => s.stage === i);
              const done = members.every((s) => visited.has(s.id));
              const here = current.stage === i;
              return (
                <li key={st.label} className={`path-step${here ? ' here' : ''}${done ? ' done' : ''}`}>
                  <button className="path-btn" onClick={() => navigate(st.entry)} aria-current={here ? 'step' : undefined}>
                    <span className="path-dot" aria-hidden="true">
                      {done ? '✓' : i + 1}
                    </span>
                    <span>
                      {st.label}
                      {done && <span className="sr-only"> (visited)</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <h2 className="nav-title">All sections</h2>
          <ul className="nav-list">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#/${s.id}`} aria-current={s.id === section ? 'page' : undefined} className={s.id === section ? 'on' : ''} onClick={(e) => { e.preventDefault(); navigate(s.id); }}>
                  <span className="nav-num">{s.number}</span>
                  <span>
                    {s.title}
                    {visited.has(s.id) && <span className="sr-only"> (visited)</span>}
                  </span>
                  {visited.has(s.id) && s.id !== section && <span className="nav-check" aria-hidden="true">✓</span>}
                </a>
              </li>
            ))}
          </ul>
          <button className="btn btn-ghost nav-reset" onClick={resetProgress}>
            Reset my progress
          </button>
        </nav>
      </aside>

      <main id="main" tabIndex={-1} className="main">
        <ErrorBoundary key={section} label={current.title}>
          <Suspense fallback={<Loading what={current.title} />}>
            <View />
          </Suspense>
        </ErrorBoundary>
        <footer className="site-foot">
          Educational simulation using illustrative parameters. Not a design tool. Nothing here is a substitute for qualified electrical work.
        </footer>
      </main>
    </div>
  );
}
