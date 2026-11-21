import type { KeyboardEvent, ReactNode } from 'react';
import { PART_INFO, type PartKey } from '../../content/startingMethods';

/** Details of the selected part, or a hint when nothing is selected. Announced politely when it changes. */
export function PartCard({ part, onClose, extra }: { part: PartKey | null; onClose: () => void; extra?: ReactNode }) {
  const info = part ? PART_INFO[part] : null;
  return (
    <div className="part-card" role="region" aria-label="Selected part" aria-live="polite">
      {info ? (
        <>
          <div className="part-card-head">
            <h3>{info.name}</h3>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
          <p>{info.role}</p>
          <p>
            <strong>If it fails: </strong>
            {info.fails}
          </p>
          {extra}
        </>
      ) : (
        <p className="muted">Select any part of the diagram (click it, or Tab to it and press Enter) to see what it does and how it fails.</p>
      )}
    </div>
  );
}

export interface PartProps {
  id: PartKey;
  label: string;
  /** Second line under the label: a value or a state, written as text so colour is never the only cue. */
  sub?: string;
  /** Clickable area in diagram units. */
  box: { x: number; y: number; w: number; h: number };
  labelAt: { x: number; y: number; anchor?: 'start' | 'middle' | 'end' };
  selected: PartKey | null;
  onSelect: (k: PartKey | null) => void;
  dim?: boolean;
  children: ReactNode;
}

/** A clickable, keyboard-operable part of an SVG diagram (toggle button semantics). */
export function Part({ id, label, sub, box, labelAt, selected, onSelect, dim, children }: PartProps) {
  const on = selected === id;
  const toggle = () => onSelect(on ? null : id);
  const onKey = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };
  const anchor = labelAt.anchor ?? 'start';
  return (
    <g
      className={`part${on ? ' on' : ''}${dim ? ' dim' : ''}`}
      role="button"
      tabIndex={0}
      aria-pressed={on}
      aria-label={`${label}${sub ? `, ${sub}` : ''}. Press for details.`}
      onClick={toggle}
      onKeyDown={onKey}
    >
      <rect className="hit" x={box.x} y={box.y} width={box.w} height={box.h} rx={8} />
      {children}
      <text className="plabel" x={labelAt.x} y={labelAt.y} textAnchor={anchor}>
        {label}
      </text>
      {sub && (
        <text className="psub" x={labelAt.x} y={labelAt.y + 15} textAnchor={anchor}>
          {sub}
        </text>
      )}
    </g>
  );
}
