import { useId, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Rich } from './Eq';
import { Term } from './Term';

const round = (v: number, step: number): number => {
  const d = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)));
  return Number(v.toFixed(d));
};

interface NumberSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  /** Glossary id: wraps the label in a tooltip term. */
  term?: string;
  disabled?: boolean;
  hint?: ReactNode;
  /** Number of decimals shown in the numeric box. */
  decimals?: number;
}

/** Labelled range slider + numeric box. Out-of-range or non-numeric typing is clamped / rejected with a message. */
export function NumberSlider({ label, value, min, max, step, unit, onChange, term, disabled, hint, decimals }: NumberSliderProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [warn, setWarn] = useState('');
  const shown = decimals !== undefined ? value.toFixed(decimals) : String(round(value, step));

  const commit = () => {
    if (draft === null) return;
    const n = draft.trim() === '' ? NaN : Number(draft);
    if (!Number.isFinite(n)) {
      setWarn(`"${draft}" is not a number. Enter a value from ${min} to ${max}${unit ? ' ' + unit : ''}.`);
    } else {
      const clamped = Math.min(max, Math.max(min, n));
      setWarn(clamped !== n ? `${n} is outside ${min}–${max}${unit ? ' ' + unit : ''}; using ${clamped}.` : '');
      onChange(clamped);
    }
    setDraft(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setDraft(null);
  };

  return (
    <div className={`ctl${disabled ? ' ctl-disabled' : ''}`}>
      <label htmlFor={`${id}-r`}>{term ? <Term id={term}>{label}</Term> : label}</label>
      <div className="ctl-row">
        <input
          id={`${id}-r`}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-valuetext={`${shown}${unit ? ' ' + unit : ''}`}
          onChange={(e) => {
            setWarn('');
            onChange(Number(e.target.value));
          }}
        />
        <span className="ctl-num">
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${label} value${unit ? ' in ' + unit : ''}`}
            value={draft ?? shown}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={onKey}
          />
          {unit && (
            <span className="unit">
              <Rich>{unit}</Rich>
            </span>
          )}
        </span>
      </div>
      {warn && (
        <p className="ctl-warn" role="status">
          {warn}
        </p>
      )}
      {hint && (
        <p className="ctl-hint">
          {typeof hint === 'string' ? <Rich>{hint}</Rich> : hint}
        </p>
      )}
    </div>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (v: T) => void;
  hideLabel?: boolean;
}

/** Radio group drawn as buttons (native radios: arrow keys work). */
export function Segmented<T extends string | number>({ label, options, value, onChange, hideLabel }: SegmentedProps<T>) {
  const name = useId();
  return (
    <fieldset className="seg">
      <legend className={hideLabel ? 'sr-only' : undefined}>{label}</legend>
      <div className="seg-row">
        {options.map((o) => (
          <label key={String(o.value)} className={`seg-opt${o.value === value ? ' on' : ''}`} title={o.title}>
            <input type="radio" name={name} checked={o.value === value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Toggle({ label, checked, onChange, disabled, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label className={`toggle${disabled ? ' ctl-disabled' : ''}`} title={hint}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-box" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

export function ResetButton({ onClick, label = 'Reset' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost" onClick={onClick}>
      <span aria-hidden="true">↺</span> {label}
    </button>
  );
}
