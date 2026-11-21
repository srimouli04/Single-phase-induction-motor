import { useMemo, type ReactNode } from 'react';
import { Callout } from '../../components/Badges';
import { Eq } from '../../components/Eq';
import { Detailed } from '../../components/Level';
import { LineChart, type PointMarker, type RefLine, type Series } from '../../components/LineChart';
import { fmtDuration } from '../../components/format';
import { COMPONENT_BY_ID } from '../../content/components';
import { FAULTS, FAULT_GROUPS, type FaultScenario } from '../../content/faults';
import ComponentView2D from '../../scenes/ComponentView2D';
import type { PartId } from '../../scenes/layout';
import { THERMAL, type FaultId, type FaultReport } from '../../simulations/faults';
import { radPerSecToRpm } from '../../simulations/motorModel';
import { compareRows, faultEvents, TONE_MARK, verdict } from './report';

const C = { healthy: '#a2b5ca', fault: '#f080aa', winding: '#46c8b2', hot: '#f2a93b', core: '#7db0ff', trip: '#f2a93b', limit: '#ff9f6b', dead: '#ff7777' };

export function FaultPicker({ selected, onSelect }: { selected: FaultId; onSelect: (id: FaultId) => void }) {
  return (
    <nav className="panel fault-picker" aria-label="Fault scenarios">
      <h2>Choose a failure</h2>
      {FAULT_GROUPS.map((g) => (
        <section key={g.id} className="fault-group" aria-labelledby={`fg-${g.id}`}>
          <h3 id={`fg-${g.id}`}>{g.label}</h3>
          <p className="muted small">{g.blurb}</p>
          <ul>
            {FAULTS.filter((f) => f.group === g.id).map((f) => (
              <li key={f.id}>
                <button type="button" className={`fault-item${f.id === selected ? ' on' : ''}`} aria-pressed={f.id === selected} onClick={() => onSelect(f.id)}>
                  {f.short}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </nav>
  );
}

export function FaultHeader({ f, r, h }: { f: FaultScenario; r: FaultReport; h: FaultReport }) {
  const v = verdict(r, h);
  return (
    <section className="panel fault-head" aria-labelledby="fault-title">
      <div className="panel-head">
        <h2 id="fault-title">{f.title}</h2>
        <span className={`pill pill-${v.tone}`}>
          <span aria-hidden="true">{TONE_MARK[v.tone]}</span> {v.label}
        </span>
      </div>
      <p>{f.lead}</p>
      {r.severityText && (
        <p className="muted small">
          <strong>Setting:</strong> {r.severityText}
        </p>
      )}
      <p className="muted small" role="status">
        {v.detail}
      </p>
    </section>
  );
}

const NOOP = () => undefined;
const NO_LABELS = new Map<string, HTMLElement>();

/** The 2D cut-away with the failed component picked out; purely an illustration, so it is removed from the tab order. */
function Location({ part, onExplore }: { part: PartId; onExplore: () => void }) {
  const state = useMemo(
    () => ({ explode: 0, selected: part, hovered: null, isolated: null, context: part, showLabels: false, housingTransparent: true, onSelect: NOOP, onHover: NOOP, labelEls: NO_LABELS }),
    [part],
  );
  return (
    <figure className="fault-loc">
      <div className="fault-loc-svg" inert aria-hidden="true">
        <ComponentView2D state={state} />
      </div>
      <figcaption>
        Where it happens: <strong>{COMPONENT_BY_ID[part].name}</strong> (highlighted, other parts faded).{' '}
        <button type="button" className="link" onClick={onExplore}>
          Find it in the 3D explorer
        </button>
      </figcaption>
    </figure>
  );
}

export function FaultStory({ f, onExplore }: { f: FaultScenario; onExplore: () => void }) {
  return (
    <section className="panel" aria-labelledby="story-h">
      <h2 id="story-h">How it works</h2>
      <div className="fault-story">
        <Location part={f.part} onExplore={onExplore} />
        <div>
          <h3>Why it happens</h3>
          <p>{f.cause}</p>
          <h3>What the fault does</h3>
          {f.how.map((p) => (
            <p key={p}>{p}</p>
          ))}
          {f.note && (
            <Callout tone="note" title="Good to know">
              {f.note}
            </Callout>
          )}
        </div>
      </div>
    </section>
  );
}

export function FaultCompare({ r, h }: { r: FaultReport; h: FaultReport }) {
  const rows = compareRows(r, h);
  return (
    <section className="panel" aria-labelledby="compare-h">
      <h2 id="compare-h">Healthy motor and faulted motor</h2>
      <p className="muted small">The same 0.25 hp capacitor-start example motor at 120 V, 60 Hz and the same load, with and without the fault. Marks: ✔ about the same, ! changed, ✖ a problem.</p>
      <div className="table-wrap">
        <table className="data compare">
          <caption className="sr-only">Measured quantities for the healthy motor and for the motor with this fault</caption>
          <thead>
            <tr>
              <th scope="col">Quantity</th>
              <th scope="col">Healthy</th>
              <th scope="col">With the fault</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">
                  {row.label}
                  {row.hint && <small>{row.hint}</small>}
                </th>
                <td>{row.healthy}</td>
                <td className={`tone-${row.tone}`}>
                  <span className="mark" aria-hidden="true">
                    {TONE_MARK[row.tone]}
                  </span>{' '}
                  {row.faulted}
                  <span className="sr-only"> ({row.tone === 'ok' ? 'normal' : row.tone === 'warn' ? 'changed' : 'problem'})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.extras.facts.length > 0 && (
        <>
          <h3>Numbers for this fault</h3>
          <ul>
            {r.extras.facts.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function speedSeries(r: FaultReport, h: FaultReport): Series[] {
  const pts = (x: FaultReport): [number, number][] => x.summary.startup.trajectory.t.map((t, i) => [t, radPerSecToRpm(x.summary.startup.trajectory.omega[i])]);
  return [
    { id: 'healthy', label: 'Healthy motor', points: pts(h), color: C.healthy, dash: '7 5', width: 2 },
    { id: 'faulted', label: 'With the fault', points: pts(r), color: C.fault, width: 3 },
  ];
}

function TemperatureChart({ r, h }: { r: FaultReport; h: FaultReport }) {
  const t = r.thermal;
  const horizon = t.t[t.t.length - 1] ?? 0;
  const minutes = horizon > 180;
  const k = minutes ? 1 / 60 : 1;
  const xy = (arr: number[]): [number, number][] => arr.map((v, i) => [t.t[i] * k, v]);
  const bearing = r.heat.hot?.kind === 'bearing';

  const series: Series[] = [{ id: 'winding', label: 'Winding (average)', points: xy(t.winding), color: C.winding, width: 3 }];
  if (t.hotLabel) series.push({ id: 'hot', label: t.hotLabel, points: xy(t.hot), color: C.hot, width: 3, dash: '10 4' });
  if (r.heat.coreW > 0 || r.heat.hot?.host === 'core') series.push({ id: 'core', label: 'Core and frame', points: xy(t.core), color: C.core, width: 2, dash: '2 4' });

  const hLines: RefLine[] = [
    { value: THERMAL.tripC, label: `Protector trip level (${THERMAL.tripC} °C)`, color: C.trip, dash: '5 4' },
    { value: t.hotLimitC, label: bearing ? `Grease limit (${t.hotLimitC} °C)` : `Insulation rating (${t.hotLimitC} °C)`, color: C.limit, dash: '8 3' },
    { value: t.hotFailC, label: bearing ? `Seizure level (${t.hotFailC} °C)` : `Destruction level (${t.hotFailC} °C)`, color: C.dead },
    { value: h.steady.winding, label: `Healthy motor, steady (${Math.round(h.steady.winding)} °C)`, color: C.healthy, dash: '1 4' },
  ];
  const markers: PointMarker[] = [];
  if (t.firstTripS !== null && t.firstTripS * k <= horizon * k) markers.push({ x: t.firstTripS * k, y: THERMAL.tripC, label: 'Protector opens', color: C.trip, shape: 'square' });
  if (t.failureS !== null) markers.push({ x: t.failureS * k, y: t.hotFailC, label: 'Destroyed', color: C.dead, shape: 'diamond' });

  const v = verdict(r, h);
  return (
    <LineChart
      title="Temperature after the fault begins"
      desc={`Winding, hot-spot and core temperature against time. ${v.label}.`}
      series={series}
      hLines={hLines}
      markers={markers}
      xLabel={minutes ? 'Time (min)' : 'Time (s)'}
      yLabel="Temperature (°C)"
      xDomain={[0, Math.max(horizon * k, 1e-6)]}
      yDomain={[30, Math.min(300, Math.max(t.hotFailC, t.peakHotC) + 25)]}
      height={320}
    />
  );
}

export function FaultCharts({ f, r, h }: { f: FaultScenario; r: FaultReport; h: FaultReport }) {
  const events = faultEvents(r);
  return (
    <section className="panel" aria-labelledby="charts-h">
      <h2 id="charts-h">What the simulation shows</h2>
      <p className="muted small">
        <strong>Watch for:</strong> {f.lookFor}
      </p>
      <div className="fault-charts">
        <LineChart
          title="Speed while starting"
          desc="Rotor speed against time for the healthy motor and the faulted motor."
          series={speedSeries(r, h)}
          xLabel="Time (s)"
          yLabel="Speed (rpm)"
          includeZeroY
          height={320}
        />
        <TemperatureChart r={r} h={h} />
      </div>
      <h3>Timeline of this run</h3>
      <ol className="events">
        {events.map((e) => (
          <li key={`${e.t}-${e.text}`} className={`tone-${e.tone}`}>
            <time className="events-t">{fmtDuration(e.t)}</time>
            <span className="mark" aria-hidden="true">
              {TONE_MARK[e.tone]}
            </span>
            <span>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FaultAdvice({ f }: { f: FaultScenario }) {
  return (
    <section className="panel" aria-labelledby="damage-h">
      <h2 id="damage-h">How the motor is damaged</h2>
      <ol className="stages">
        {f.progression.map((s) => (
          <li key={s.when}>
            <strong>{s.when}</strong>
            <span>{s.what}</span>
          </li>
        ))}
      </ol>
      <div className="fault-cols">
        <div>
          <h3>What you would notice</h3>
          <ul>
            {f.symptoms.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>How it is found</h3>
          <ul>
            {f.checks.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>What protects the motor</h3>
          <p>{f.protection}</p>
        </div>
      </div>
    </section>
  );
}

/** Equations behind each scenario's numbers (Detailed level only). */
const FORMULAS: Partial<Record<FaultId, { eq: string; text: ReactNode }[]>> = {
  'turn-short': [
    { eq: 'I_{loop} = k V / |Z_{loop}|,  P = I_{loop}² (k r_1 + R_f)', text: (<>k is the share of turns shorted, <Eq>R_f</Eq> the contact resistance of the short and <Eq>r_1</Eq> the winding resistance. The loop sees k times the voltage and almost no impedance.</>) },
    { eq: 'I_{extra} ≈ P / V', text: 'The supply only has to supply the heat produced in the loop, so the line current rises little.' },
  ],
  'core-short': [{ eq: 'P_{extra} = 20 × f × P_{iron}', text: 'f is the share of the core length bridged. Eddy loss rises roughly with the square of the loop size, so the bridged region loses about twenty times more.' }],
  'ground-fault': [{ eq: 'I_g = V / (R_f + R_w),  P_f = I_g² R_f', text: (<><Eq>R_f</Eq> is the resistance of the fault and <Eq>R_w</Eq> the part of the winding between the supply and the fault. The power at the fault spot is what melts copper and chars insulation.</>) }],
  'bearing-wear': [{ eq: 'P_{bearing} = T_{friction} ω', text: 'Friction torque times shaft speed is turned into heat in the bearing.' }],
  'broken-bars': [{ eq: 'r_2′ = r_2 / (1 − n / N)', text: 'With n of N bars broken the cage resistance rises, so the slip rises for the same torque.' }],
  'low-voltage': [{ eq: 'T ∝ V²', text: 'Torque at any given slip scales with the square of the voltage.' }],
};

export function FaultFormulas({ id }: { id: FaultId }) {
  const list = FORMULAS[id] ?? [];
  return (
    <Detailed>
      <h3>The equations behind the numbers</h3>
      {list.map((f) => (
        <div key={f.eq}>
          <Eq block>{f.eq}</Eq>
          <p className="muted small">{f.text}</p>
        </div>
      ))}
      <Eq block>{'L = 20 000 h × 2^{(130 − T) / 10}'}</Eq>
      <p className="muted small">Insulation life halves for every 10 K above the 130 °C rating (the “10-degree rule”). It describes slow thermal ageing only, not arcing or sudden breakdown.</p>
      <h3>The heat model</h3>
      <p>
        Three lumped heat stores are joined by thermal resistances: the winding ({THERMAL.cWinding} J/K), the core, rotor and frame ({THERMAL.cCore} J/K) and, when the fault is local, a hot spot that holds a share of one of them. Heat leaves
        through the frame to {THERMAL.ambientC} °C air ({THERMAL.rCoreAmbient} K/W with clean cooling). The protector opens when the average winding reaches {THERMAL.tripC} °C and closes at {THERMAL.resetC} °C. The run stops where the insulation is
        destroyed ({THERMAL.failC} °C), because the model is no longer valid after that.
      </p>
      <p className="muted small">The protector in this model senses temperature only. Real protectors often also sense current, so they can react sooner. All thermal values are illustrative, chosen to be the right order of magnitude for a small motor.</p>
    </Detailed>
  );
}
