import type { ReactNode } from 'react';
import { Term } from './Term';

export interface Reading {
  label: string;
  value: string;
  unit?: string;
  hint?: ReactNode;
  /** Glossary id for a hover definition of the label. */
  term?: string;
  tone?: 'ok' | 'warn' | 'bad';
}

/** Grid of labelled values. Tone is also written as text/shape-free class so colour is never the only cue (hint states it). */
export function Readouts({ items, label }: { items: Reading[]; label: string }) {
  return (
    <dl className="kv" aria-label={label}>
      {items.map((r) => (
        <div key={r.label} className={r.tone ? `kv-${r.tone}` : undefined}>
          <dt>{r.term ? <Term id={r.term}>{r.label}</Term> : r.label}</dt>
          <dd>
            {r.value}
            {r.unit && <small>{r.unit}</small>}
          </dd>
          {r.hint && <p className="kv-hint">{r.hint}</p>}
        </div>
      ))}
    </dl>
  );
}
