import type { ReactNode } from 'react';
import { useApp } from '../state';

/** Extra technical content, shown only when the "Detailed" explanation level is selected. */
export function Detailed({ children }: { children: ReactNode }) {
  const { prefs } = useApp();
  if (prefs.detail !== 'detailed') return null;
  return (
    <div className="detailed">
      <span className="detailed-tag">Detailed</span>
      {children}
    </div>
  );
}

/** Content shown only at the "Beginner" level (e.g. an analogy that the detailed text replaces). */
export function Beginner({ children }: { children: ReactNode }) {
  const { prefs } = useApp();
  if (prefs.detail !== 'beginner') return null;
  return <div className="beginner">{children}</div>;
}
