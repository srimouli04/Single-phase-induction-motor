import { useId, type ReactNode } from 'react';
import { getTerm } from '../content/glossary';
import { Rich } from './Eq';

/** Inline glossary term with a hover / focus tooltip. */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const tipId = useId();
  const entry = getTerm(id);
  if (!entry) return <>{children}</>;
  return (
    <span className="term" tabIndex={0} aria-describedby={tipId}>
      {children ?? <Rich>{entry.term}</Rich>}
      <span role="tooltip" id={tipId} className="term-tip">
        <strong>
          <Rich>{entry.term}</Rich>.
        </strong>{' '}
        <Rich>{entry.short}</Rich>
      </span>
    </span>
  );
}
