import type { ReactNode } from 'react';
import { SECTION_BY_ID, STAGES, type SectionId } from '../content/sections';
import { useApp } from '../state';

/** Common page frame: heading, one-line purpose, and a "next step" button following the suggested sequence. */
export function Page({ id, children }: { id: SectionId; children: ReactNode }) {
  const info = SECTION_BY_ID[id];
  const { navigate } = useApp();
  const next = info.next ? SECTION_BY_ID[info.next] : null;
  return (
    <article className="page">
      <header className="page-head">
        <p className="eyebrow">
          Section {info.number}
          {info.stage >= 0 ? ` · ${STAGES[info.stage].label}` : ' · Reference'}
        </p>
        <h1>{info.title}</h1>
        <p className="lede">{info.blurb}</p>
      </header>
      {children}
      {next && (
        <footer className="page-foot">
          <button className="btn btn-primary" onClick={() => navigate(next.id)}>
            Next: {next.title} →
          </button>
        </footer>
      )}
    </article>
  );
}

/** Loading placeholder for lazily loaded sections. */
export function Loading({ what }: { what: string }) {
  return (
    <div className="state state-loading" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      Loading {what}…
    </div>
  );
}
