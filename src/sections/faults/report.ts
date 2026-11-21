// Turns a FaultReport into the sentences, table rows and event list the Faults page shows. Pure functions: no React.
import { fmt, fmtDuration, fmtInt, fmtLife } from '../../components/format';
import { BREAKER_RATING_A, RCD_TRIP_A, THERMAL, type FaultReport } from '../../simulations/faults';
import { OUTCOME_TEXT } from '../../simulations/metrics';

export type Tone = 'ok' | 'warn' | 'bad';
export const TONE_MARK: Record<Tone, string> = { ok: '✔', warn: '!', bad: '✖' };

export interface Verdict {
  tone: Tone;
  label: string;
  detail: string;
}

/** One-line outcome of the thermal run: destroyed, held off by the protector, or survivable. */
export function verdict(r: FaultReport, healthy: FaultReport): Verdict {
  const t = r.thermal;
  if (t.failureS !== null) {
    return {
      tone: 'bad',
      label: `${t.failureLabel} destroyed after ${fmtDuration(t.failureS)}`,
      detail: `It reaches ${t.hotFailC} °C, where insulation chars and the winding fails. This is a model of the trend, not a prediction of the exact time.`,
    };
  }
  if (t.firstTripS !== null) {
    return {
      tone: 'warn',
      label: `Protector opens after ${fmtDuration(t.firstTripS)}`,
      detail: `While the fault remains it then cycles on and off about ${t.tripCount} ${t.tripCount === 1 ? 'time' : 'times'} an hour, and every cycle ages the insulation.`,
    };
  }
  if (r.lifeHours !== null && healthy.lifeHours !== null && r.lifeHours < healthy.lifeHours / 3) {
    return {
      tone: 'warn',
      label: `Runs, but insulation life falls to about ${fmtLife(r.lifeHours)}`,
      detail: `Nothing trips, so the motor looks fine while it is being used up. The healthy motor would last about ${fmtLife(healthy.lifeHours)} at its steady temperature.`,
    };
  }
  return { tone: 'ok', label: 'Runs normally', detail: 'This setting does not heat the motor enough to matter on this time scale.' };
}

export interface FaultEvent {
  t: number;
  tone: Tone;
  text: string;
}

/** Dated events of the simulated run, in time order: when things get too hot, trip or are destroyed. */
export function faultEvents(r: FaultReport): FaultEvent[] {
  const t = r.thermal;
  const ev: FaultEvent[] = [];
  if (t.firstLimitS !== null) {
    ev.push({ t: t.firstLimitS, tone: 'warn', text: `The hottest point passes its rating of ${t.hotLimitC} °C` });
  }
  if (t.firstTripS !== null) ev.push({ t: t.firstTripS, tone: 'warn', text: `The winding thermal protector opens (${THERMAL.tripC} °C)` });
  if (t.failureS !== null) ev.push({ t: t.failureS, tone: 'bad', text: `${t.failureLabel} reaches ${t.hotFailC} °C and is destroyed` });
  if (r.rcdTrips) ev.push({ t: 0.03, tone: 'ok', text: 'A 30 mA residual-current device (RCD) would open within milliseconds' });
  if (r.breakerTripS !== null) {
    const late = t.failureS !== null && r.breakerTripS > t.failureS;
    ev.push({ t: r.breakerTripS, tone: late ? 'bad' : 'ok', text: `A ${BREAKER_RATING_A} A breaker would open${late ? ', far too late to save the winding' : ''}` });
  }
  ev.sort((a, b) => a.t - b.t);
  if (ev.length === 0) ev.push({ t: 0, tone: 'ok', text: 'Nothing gets hot enough to trip a protector or damage the insulation during the simulated hour' });
  return ev;
}

export interface CompareRow {
  label: string;
  healthy: string;
  faulted: string;
  tone: Tone;
  hint?: string;
}

const ratioTone = (f: number, h: number, warn = 1.15, bad = 3): Tone => (h <= 0 ? 'ok' : f / h >= bad ? 'bad' : f / h >= warn ? 'warn' : 'ok');
const amps = (a: number): string => (a < 1 ? `${(a * 1000).toFixed(0)} mA` : `${fmt(a, 1)} A`);
const totalHeat = (r: FaultReport): number => r.heat.windingW + r.heat.coreW + (r.heat.hot?.powerW ?? 0);

/** Healthy-versus-faulted table: electrical numbers first, then what the protection does. */
export function compareRows(r: FaultReport, h: FaultReport): CompareRow[] {
  const s = r.summary;
  const hs = h.summary;
  const rows: CompareRow[] = [];

  rows.push({ label: 'Does it start?', healthy: OUTCOME_TEXT[hs.startup.outcome].label, faulted: OUTCOME_TEXT[s.startup.outcome].label, tone: OUTCOME_TEXT[s.startup.outcome].tone });

  const speed = s.startup.finalSpeedRpm;
  const hSpeed = hs.startup.finalSpeedRpm;
  rows.push({ label: 'Speed when settled', healthy: `${fmtInt(hSpeed)} rpm`, faulted: `${fmtInt(speed)} rpm`, tone: speed < 0.5 * hSpeed ? 'bad' : speed < 0.98 * hSpeed ? 'warn' : 'ok' });

  rows.push({
    label: 'Starting torque',
    healthy: `${fmt(hs.startTorque, 2)} N·m`,
    faulted: `${fmt(s.startTorque, 2)} N·m`,
    tone: s.startTorque < s.inputs.loadTorque ? 'bad' : s.startTorque < 0.8 * hs.startTorque ? 'warn' : 'ok',
    hint: `The load needs ${fmt(s.inputs.loadTorque, 2)} N·m to get going`,
  });

  rows.push({ label: 'Starting current', healthy: `${fmt(hs.startCurrent, 1)} A`, faulted: `${fmt(s.startCurrent, 1)} A`, tone: ratioTone(s.startCurrent, hs.startCurrent, 1.15, 2) });
  rows.push({
    label: s.running ? 'Supply current, running' : 'Supply current, stuck',
    healthy: `${fmt(h.lineCurrentA, 1)} A`,
    faulted: `${fmt(r.lineCurrentA, 1)} A`,
    tone: ratioTone(r.lineCurrentA, h.lineCurrentA),
    hint: `Breaker rating ${BREAKER_RATING_A} A`,
  });
  rows.push({ label: 'Heat released in the motor', healthy: `${fmtInt(totalHeat(h))} W`, faulted: `${fmtInt(totalHeat(r))} W`, tone: ratioTone(totalHeat(r), totalHeat(h)) });

  const hot = r.steady.hot;
  rows.push({
    label: 'Hottest point if left running',
    healthy: `${fmtInt(h.steady.hot)} °C`,
    faulted: hot >= THERMAL.failC ? `> ${THERMAL.failC} °C (destroyed)` : `${fmtInt(hot)} °C`,
    tone: hot >= r.thermal.hotLimitC ? 'bad' : hot > h.steady.hot + 15 ? 'warn' : 'ok',
    hint: `Ambient ${THERMAL.ambientC} °C. The insulation rating is ${THERMAL.limitC} °C`,
  });
  rows.push({
    label: 'Insulation life, continuous running',
    healthy: fmtLife(h.lifeHours),
    faulted: r.lifeHours === null ? 'Destroyed outright' : fmtLife(r.lifeHours),
    tone: r.lifeHours === null ? 'bad' : h.lifeHours !== null && r.lifeHours < h.lifeHours / 3 ? 'warn' : 'ok',
    hint: 'Halves for every 10 K above the rating',
  });

  if (r.extras.groundCurrentA !== null) {
    rows.push({ label: 'Current into the frame', healthy: '0 mA', faulted: amps(r.extras.groundCurrentA), tone: r.extras.groundCurrentA >= RCD_TRIP_A ? 'bad' : 'warn', hint: 'Above 30 mA is dangerous to people' });
  }

  const t = r.thermal;
  const hurt = t.failureS !== null || t.firstTripS !== null || r.thermal.firstLimitS !== null;
  rows.push({
    label: `${BREAKER_RATING_A} A breaker`,
    healthy: 'Never opens',
    faulted: r.breakerTripS === null ? 'Never opens' : `Opens after ${fmtDuration(r.breakerTripS)}`,
    tone: r.breakerTripS === null ? (hurt ? 'bad' : 'ok') : t.failureS !== null && r.breakerTripS > t.failureS ? 'bad' : 'ok',
  });
  rows.push({
    label: 'Winding thermal protector',
    healthy: 'Never opens',
    faulted: t.firstTripS === null ? 'Never opens' : `Opens after ${fmtDuration(t.firstTripS)}`,
    tone: t.failureS !== null && (t.firstTripS === null || t.firstTripS > t.failureS) ? 'bad' : t.firstTripS !== null ? 'warn' : 'ok',
    hint: 'Senses the average winding temperature only',
  });
  if (r.extras.groundCurrentA !== null) {
    rows.push({ label: '30 mA RCD (if fitted)', healthy: 'Stays closed', faulted: r.rcdTrips ? 'Opens at once' : 'Stays closed (leak below 30 mA)', tone: r.rcdTrips ? 'ok' : 'warn' });
  }
  return rows;
}
