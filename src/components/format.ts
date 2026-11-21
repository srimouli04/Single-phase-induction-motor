/** Number formatting helpers: never print NaN / Infinity to a student. */
export const fmt = (v: number | null | undefined, digits = 2): string => (v === null || v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(digits));
export const fmtInt = (v: number | null | undefined): string => (v === null || v === undefined || !Number.isFinite(v) ? '–' : Math.round(v).toLocaleString('en-US'));
export const fmtPct = (v: number | null | undefined, digits = 0): string => (v === null || v === undefined || !Number.isFinite(v) ? '–' : `${(v * 100).toFixed(digits)}`);

/** Duration in seconds as "0.40 s", "36 s", "1 min 37 s", "25 min", "1.5 h". */
export function fmtDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return '–';
  if (seconds < 1) return `${seconds.toFixed(2)} s`;
  if (seconds < 10) return `${seconds.toFixed(1)} s`;
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 600) {
    let m = Math.floor(seconds / 60);
    let s = Math.round(seconds - m * 60);
    if (s === 60) {
      m += 1;
      s = 0;
    }
    return s === 0 ? `${m} min` : `${m} min ${s} s`;
  }
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  return `${(seconds / 3600).toFixed(1)} h`;
}

/** Life in hours as minutes, hours, days or years (">100 years" caps the very long ones). */
export function fmtLife(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return '–';
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
  if (hours < 72) return `${Math.round(hours)} h`;
  const days = hours / 24;
  if (days < 365) return `${Math.round(days)} days`;
  const years = hours / 8766;
  return years > 100 ? '> 100 years' : `${years < 10 ? years.toFixed(1) : Math.round(years)} years`;
}
