import { useMemo } from 'react';
import { Callout } from '../../components/Badges';
import { NumberSlider, ResetButton } from '../../components/Controls';
import { LineChart, type PointMarker, type Series } from '../../components/LineChart';
import { fmt } from '../../components/format';
import { METHOD_BY_ID, STARTING_METHODS, type MethodId } from '../../content/startingMethods';
import { OUTCOME_TEXT, lineCurrent } from '../../simulations/metrics';
import { LIMITS } from '../../simulations/motorModel';
import { COMPARE_IDS, COMPARE_LABEL, type CompareId, type Comparison as Result } from '../../simulations/starting';

const STYLE: Record<CompareId, { color: string; dash?: string }> = {
  'split-phase': { color: '#7db0ff', dash: '9 5' },
  'capacitor-start': { color: '#f2a93b' },
  psc: { color: '#46c8b2', dash: '3 3' },
  cscr: { color: '#b79cff', dash: '12 3 2 3' },
};
const isCompare = (id: MethodId): id is CompareId => (COMPARE_IDS as readonly string[]).includes(id);

interface Props {
  /** Result for the load shown (computed by the page so the diagram and the tables agree). */
  cmp: Result | { error: string };
  /** Load torque in the slider (may be ahead of `cmp` while a new result is computed). */
  load: number;
  onLoad: (v: number) => void;
  onResetLoad: () => void;
  stale: boolean;
  selected: MethodId;
  onSelect: (id: MethodId) => void;
}

export default function Comparison({ cmp, load, onLoad, onResetLoad, stale, selected, onSelect }: Props) {
  const chart = useMemo(() => {
    if ('error' in cmp) return null;
    const series: Series[] = [
      { id: 'main', label: 'Main winding only', color: '#8a98ab', width: 1.8, dash: '1 5', points: cmp.mainOnly },
      ...cmp.methods.map<Series>((m) => ({ id: m.id, label: COMPARE_LABEL[m.id], color: STYLE[m.id].color, dash: STYLE[m.id].dash, width: m.id === selected ? 3.6 : 2.2, points: m.path })),
    ];
    const sel = isCompare(selected) ? cmp.methods.find((m) => m.id === selected) : undefined;
    const markers: PointMarker[] = sel ? [{ x: 0, y: sel.start.torqueNet, label: `Start ${fmt(sel.start.torqueNet, 2)} N·m`, color: STYLE[sel.id].color, shape: 'square' }] : [];
    return { series, markers };
  }, [cmp, selected]);

  return (
    <section className={`panel${stale ? ' is-stale' : ''}`} aria-labelledby="compare-h" aria-busy={stale}>
      <div className="panel-head">
        <h2 id="compare-h">Compare the methods</h2>
        <ResetButton onClick={onResetLoad} label="Reset load" />
      </div>
      <p className="muted">
        Torque against speed, along the path each motor actually takes: the start-circuit curve up to the switch speed, then the running curve. Raise the load and see which methods can still start it.
      </p>
      <div className="compare-controls">
        <NumberSlider label="Load torque" term="loadTorque" value={load} min={LIMITS.loadTorque.min} max={LIMITS.loadTorque.max} step={LIMITS.loadTorque.step} unit="N·m" decimals={2} onChange={onLoad} hint="Constant torque, the same for every method. Example-motor values, see the notes below." />
      </div>

      {'error' in cmp || !chart ? (
        <div className="state state-error" role="alert">
          <h3>These settings could not be solved</h3>
          <p>{'error' in cmp ? cmp.error : ''}</p>
          <button type="button" className="btn" onClick={onResetLoad}>
            Reset the load
          </button>
        </div>
      ) : (
        <>
          <LineChart
            title="Torque against speed for each starting method"
            desc="Net torque against rotor speed for split-phase, capacitor-start, PSC and CSCR motors, with the main winding alone as a reference and the load torque as a horizontal line. The curves of the switched methods drop at the switch speed."
            series={chart.series}
            markers={chart.markers}
            hLines={[{ value: cmp.loadTorque, label: 'Load torque', color: '#e9eff7', dash: '3 4' }]}
            vLines={[{ value: cmp.cutoutRpm, label: 'Switch opens', color: '#f2a93b', dash: '6 4' }]}
            xDomain={[0, cmp.nsRpm]}
            xLabel="Rotor speed (rpm)"
            yLabel="Torque (N·m)"
            includeZeroY
            height={340}
          />

          <h3>Computed for the example motor</h3>
          <div className="table-wrap" role="region" aria-label="Computed comparison table, scrolls sideways on narrow screens" tabIndex={0}>
            <table className="data compare-table">
              <caption>
                Same equivalent circuit and supply as the Physics lab, at a load of {fmt(cmp.loadTorque, 2)} N·m. CSCR is analytical: its switch-over is not simulated.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col">Start torque (N·m)</th>
                  <th scope="col">Start current (A)</th>
                  <th scope="col">Standstill torque vs load</th>
                  <th scope="col">Simulated start-up</th>
                  <th scope="col">Running speed (rpm)*</th>
                  <th scope="col">Running current (A)*</th>
                  <th scope="col">Running power factor*</th>
                </tr>
              </thead>
              <tbody>
                {cmp.methods.map((m) => {
                  const ratio = cmp.loadTorque > 0 ? m.start.torqueNet / cmp.loadTorque : null;
                  const out = m.summary ? OUTCOME_TEXT[m.summary.startup.outcome] : null;
                  return (
                    <tr key={m.id} className={m.id === selected ? 'sel' : undefined} aria-current={m.id === selected ? 'true' : undefined}>
                      <th scope="row">
                        <button type="button" className="link" onClick={() => onSelect(m.id)}>
                          {COMPARE_LABEL[m.id]}
                        </button>
                        {m.id === selected && <span className="sr-only"> (selected)</span>}
                      </th>
                      <td>{fmt(m.start.torqueNet, 2)}</td>
                      <td>{fmt(lineCurrent(m.start), 1)}</td>
                      <td>
                        {ratio === null ? (
                          '–'
                        ) : (
                          <>
                            {fmt(ratio, 1)}× load <span className={`pill ${ratio > 1 ? 'pill-ok' : 'pill-bad'}`}>{ratio > 1 ? 'enough to turn it' : 'too weak'}</span>
                          </>
                        )}
                      </td>
                      <td>{out ? <span className={`pill pill-${out.tone}`}>{out.label}</span> : <span className="muted">Not simulated</span>}</td>
                      <td>{m.runSpeedRpm === null ? <span title="The load exceeds the breakdown torque of the running curve">none</span> : fmt(m.runSpeedRpm, 0)}</td>
                      <td>{m.run ? fmt(lineCurrent(m.run), 2) : '–'}</td>
                      <td>{m.run ? fmt(m.run.powerFactor, 2) : '–'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small">
            * Where the running torque curve meets the load line. The motor only gets there if it starts. Split-phase and capacitor-start run on the main winding alone; PSC and CSCR run with the run capacitor in circuit. Example capacitors: 150 µF start, 25 µF run.
          </p>
        </>
      )}

      <h3>Typical characteristics (textbook rules of thumb, not computed)</h3>
      <div className="table-wrap" role="region" aria-label="Typical characteristics table, scrolls sideways on narrow screens" tabIndex={0}>
        <table className="data compare-table">
          <caption>Percentages and multiples are of full-load values for a motor of the same rating. They vary with design, so they are not comparable with the computed numbers above.</caption>
          <thead>
            <tr>
              <th scope="col">Method</th>
              <th scope="col">Starting torque</th>
              <th scope="col">Starting current</th>
              <th scope="col">Running power factor</th>
              <th scope="col">Cost</th>
              <th scope="col">Typical size</th>
              <th scope="col">Reversing</th>
            </tr>
          </thead>
          <tbody>
            {STARTING_METHODS.map((m) => (
              <tr key={m.id} className={m.id === selected ? 'sel' : undefined} aria-current={m.id === selected ? 'true' : undefined}>
                <th scope="row">
                  <button type="button" className="link" onClick={() => onSelect(m.id)}>
                    {m.short}
                  </button>
                  {m.id === selected && <span className="sr-only"> (selected)</span>}
                </th>
                <td>{m.typical.startTorque}</td>
                <td>{m.typical.startCurrent}</td>
                <td>{m.typical.powerFactor}</td>
                <td>{m.typical.cost}</td>
                <td>{m.typical.size}</td>
                <td>{m.typical.reversing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Callout title="Why the computed and typical tables do not match number for number">
        <p>
          The example motor is one illustrative 1/4 hp-class design with round-number parameters. The typical table describes whole families of real motors, and a real motor’s figures depend on its design and rating. Use the computed table to compare methods with one another on the same motor, and the typical table to know what to expect from the families.
        </p>
      </Callout>
      <p className="muted small">Selected: {METHOD_BY_ID[selected].title}. Click a method name in either table to select it above.</p>
    </section>
  );
}
