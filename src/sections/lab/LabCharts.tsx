import { useMemo } from 'react';
import { LineChart, type Band, type PointMarker, type RefLine, type Series } from '../../components/LineChart';
import { currentWaveforms } from '../../simulations/dynamics';
import { lineCurrent, turnsInReverse, type LabSummary } from '../../simulations/metrics';
import { radPerSecToRpm, type Solution } from '../../simulations/motorModel';

export const COLORS = { main: '#46c8b2', aux: '#f2a93b', fwd: '#7db0ff', bwd: '#f080aa', ink: '#e9eff7', speed: '#7db0ff' };

interface Props {
  s: LabSummary;
  showReverse: boolean;
  showComponents: boolean;
  waveAt: 'start' | 'run';
}

/** Time ranges during which the auxiliary branch is connected (drawn as hatched bands). */
export function auxBands(t: number[], on: boolean[]): Band[] {
  const out: Band[] = [];
  let from: number | null = null;
  for (let i = 0; i < t.length; i++) {
    if (on[i] && from === null) from = t[i];
    if ((!on[i] || i === t.length - 1) && from !== null) {
      out.push({ from, to: t[i], label: 'Start circuit connected' });
      from = null;
    }
  }
  return out;
}

/** Keep at most `max` points (charts do not need 2400 samples). */
export const thin = <T,>(a: T[], max = 400): T[] => (a.length <= max ? a : a.filter((_, i) => i % Math.ceil(a.length / max) === 0 || i === a.length - 1));

export function LabCharts({ s, showReverse: showReverseChoice, showComponents, waveAt }: Props) {
  const { nsRpm: ns, curves, inputs, startup } = s;
  const showReverse = showReverseChoice || turnsInReverse(s); // a motor turning in reverse has its operating point on the negative-speed side
  const hasAux = curves.aux !== null;
  const usesSwitch = hasAux && (inputs.method === 'split-phase' || inputs.method === 'capacitor-start');

  const torque = useMemo(() => {
    const pts = (sols: Solution[], f: (x: Solution) => number) => sols.filter((x) => showReverse || x.slip <= 1).map((x) => [ns * (1 - x.slip), f(x)] as const);
    const series: Series[] = [{ id: 'main', label: 'Main winding only', color: COLORS.main, width: 2.6, points: pts(curves.main, (x) => x.torqueNet) }];
    if (curves.aux) series.push({ id: 'aux', label: 'With start circuit', color: COLORS.aux, dash: '9 5', width: 2.6, points: pts(curves.aux, (x) => x.torqueNet) });
    if (showComponents) {
      series.push({ id: 'fwd', label: 'Forward-field torque (main only)', color: COLORS.fwd, dash: '2 4', width: 2, points: pts(curves.main, (x) => x.torqueF) });
      series.push({ id: 'bwd', label: 'Backward-field torque (main only, drawn negative)', color: COLORS.bwd, dash: '1 6', width: 2, points: pts(curves.main, (x) => -x.torqueB) });
    }
    return series;
  }, [curves, ns, showReverse, showComponents]);

  const current = useMemo(() => {
    const pts = (sols: Solution[]) => sols.filter((x) => showReverse || x.slip <= 1).map((x) => [ns * (1 - x.slip), lineCurrent(x)] as const);
    const series: Series[] = [{ id: 'main', label: 'Main winding only', color: COLORS.main, width: 2.6, points: pts(curves.main) }];
    if (curves.aux) series.push({ id: 'aux', label: 'With start circuit', color: COLORS.aux, dash: '9 5', width: 2.6, points: pts(curves.aux) });
    return series;
  }, [curves, ns, showReverse]);

  const runRpm = radPerSecToRpm(startup.finalOmega); // signed: negative when the motor turns in reverse
  const startColor = hasAux ? COLORS.aux : COLORS.main;
  const torqueMarkers: PointMarker[] = [
    { x: 0, y: s.startTorque, label: `Start ${s.startTorque.toFixed(2)} N·m`, color: startColor, shape: 'square' },
    { x: s.breakdown.speedRpm, y: s.breakdown.torque, label: `Breakdown ${s.breakdown.torque.toFixed(2)} N·m`, color: COLORS.ink, shape: 'diamond' },
  ];
  if (s.running) torqueMarkers.push({ x: runRpm, y: s.run.torqueNet, label: `Operating ${runRpm.toFixed(0)} rpm`, color: COLORS.speed, shape: 'circle' });
  const currentMarkers: PointMarker[] = [{ x: 0, y: s.startCurrent, label: `Start ${s.startCurrent.toFixed(1)} A`, color: startColor, shape: 'square' }];
  if (s.running) currentMarkers.push({ x: runRpm, y: lineCurrent(s.run), label: `Running ${lineCurrent(s.run).toFixed(1)} A`, color: COLORS.speed, shape: 'circle' });

  const hLoad: RefLine[] = [{ value: inputs.loadTorque, label: 'Load torque', color: COLORS.ink, dash: '3 4' }];
  const vSwitch: RefLine[] = usesSwitch ? [{ value: inputs.cutoutFraction * ns, label: 'Switch opens', color: COLORS.aux, dash: '6 4' }] : [];
  const reverseBand: Band[] = showReverse ? [{ from: -ns, to: 0, label: 'Reverse rotation' }] : [];
  const xDomain: [number, number] = showReverse ? [-ns, ns] : [0, ns];

  const time = useMemo(() => {
    const tr = startup.trajectory;
    const idx = thin(tr.t.map((_, i) => i));
    return {
      points: idx.map((i) => [tr.t[i], radPerSecToRpm(tr.omega[i])] as const),
      bands: auxBands(tr.t, tr.auxOn),
    };
  }, [startup]);
  const timeMarkers: PointMarker[] =
    startup.timeToSpeed !== null ? [{ x: startup.timeToSpeed, y: 0.9 * startup.finalSpeedRpm, label: `90 % of final speed at ${startup.timeToSpeed.toFixed(2)} s`, color: COLORS.ink, shape: 'diamond' }] : [];

  const wave = useMemo(() => currentWaveforms(waveAt === 'start' ? s.start : s.run, inputs.frequencyHz, 2), [s.start, s.run, waveAt, inputs.frequencyHz]);
  const waveSeries: Series[] = [
    { id: 'main', label: 'Main winding current', color: COLORS.main, width: 2.6, points: wave.map((w) => [w.tMs, w.main] as const) },
    ...(hasAux ? [{ id: 'aux', label: 'Auxiliary winding current', color: COLORS.aux, dash: '9 5', width: 2.6, points: wave.map((w) => [w.tMs, w.aux] as const) }] : []),
  ];

  return (
    <div className="grid-2 lab-charts">
      <LineChart
        title="Torque against speed"
        desc="Net motor torque against rotor speed for the main winding alone and with the starting circuit, with the load torque as a horizontal line."
        series={torque}
        markers={torqueMarkers}
        hLines={hLoad}
        vLines={vSwitch}
        bands={reverseBand}
        xLabel="Rotor speed (rpm)"
        yLabel="Torque (N·m)"
        xDomain={xDomain}
        includeZeroY
      />
      <LineChart
        title="Line current against speed"
        desc="Supply current against rotor speed. It is highest at standstill and falls as the rotor speeds up."
        series={current}
        markers={currentMarkers}
        vLines={vSwitch}
        bands={reverseBand}
        xLabel="Rotor speed (rpm)"
        yLabel="Line current (A rms)"
        xDomain={xDomain}
        includeZeroY
      />
      <LineChart
        title="Speed against time"
        desc="Simulated rotor speed after switching on. Hatched bands show when the starting circuit is connected."
        series={[{ id: 'speed', label: 'Rotor speed', color: COLORS.speed, width: 2.6, points: time.points }]}
        markers={timeMarkers}
        hLines={[{ value: ns, label: 'Synchronous speed', color: COLORS.ink, dash: '3 4' }]}
        bands={time.bands}
        xLabel="Time (s)"
        yLabel="Speed (rpm)"
        includeZeroY
      />
      <LineChart
        title={waveAt === 'start' ? 'Winding currents at standstill' : 'Winding currents at the operating speed'}
        desc="Two cycles of the main and auxiliary winding currents. The time shift between them is what makes the field rotate."
        series={waveSeries}
        xLabel="Time (ms)"
        yLabel="Current (A, instantaneous)"
      />
    </div>
  );
}
