import type { ReactNode } from 'react';

const KINDS = {
  illustration: { label: 'Visual illustration', icon: '◐', text: 'Drawn to help you see an idea. Shapes, sizes and speeds are not to scale and are not measurements.' },
  analytical: { label: 'Simplified analytical model', icon: 'ƒ', text: 'Equations with stated assumptions and example (not real-motor) parameters.' },
  numerical: { label: 'Numerical calculation', icon: '∑', text: 'Values computed by the program from the model equations. They are estimates, not measurements.' },
  qualitative: { label: 'Qualitative explanation', icon: '≈', text: 'Describes expected trends only; no numbers are computed for this part.' },
} as const;

export type BadgeKind = keyof typeof KINDS;

/** Tells the student whether a panel is an illustration, an analytical model or a numerical calculation. */
export function ModelBadge({ kinds, children }: { kinds: BadgeKind[]; children?: ReactNode }) {
  return (
    <div className="badge-row">
      <ul className="badges" aria-label="What kind of content is this panel?">
        {kinds.map((k) => (
          <li key={k} className={`badge badge-${k}`} title={KINDS[k].text}>
            <span aria-hidden="true">{KINDS[k].icon}</span> {KINDS[k].label}
          </li>
        ))}
      </ul>
      {children && <p className="badge-note">{children}</p>}
    </div>
  );
}

const ICONS = { note: 'ℹ', warning: '⚠', safety: '⚠', tip: '✔' } as const;

export function Callout({ tone = 'note', title, children }: { tone?: keyof typeof ICONS; title: string; children: ReactNode }) {
  return (
    <aside className={`callout callout-${tone}`}>
      <strong className="callout-title">
        <span aria-hidden="true">{ICONS[tone]}</span> {title}
      </strong>
      <div>{children}</div>
    </aside>
  );
}
