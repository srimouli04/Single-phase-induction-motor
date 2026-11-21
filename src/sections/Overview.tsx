import { Page } from '../components/Page';
import { ModelBadge } from '../components/Badges';
import { Beginner, Detailed } from '../components/Level';
import { COMPONENTS, type MotorComponent } from '../content/components';
import { STAGES, type SectionId } from '../content/sections';
import { STARTING_METHODS } from '../content/startingMethods';
import { useApp } from '../state';
import EnergyChain from './overview/EnergyChain';
import PhaseDemo from './overview/PhaseDemo';
import SpeedSlip from './overview/SpeedSlip';
import { TOUR_PARTS } from './overview/tour';

const OUTCOMES: { text: string; where: SectionId; label: string }[] = [
  { text: 'Name the parts of the motor and say what each one does.', where: 'explorer', label: 'Section 2' },
  { text: 'Explain why one winding gives a pulsating field and no starting torque, with the double-revolving-field idea.', where: 'field', label: 'Section 3' },
  { text: 'Explain how an auxiliary winding and a capacitor make the motor start, and compare the common types.', where: 'starting', label: 'Section 4' },
  { text: 'Work out synchronous speed and slip, and read torque–speed and current–speed curves.', where: 'lab', label: 'Section 5' },
  { text: 'Predict what happens when a parameter changes, and recognise the symptoms of common faults.', where: 'experiments', label: 'Sections 6 and 7' },
];

export default function Overview() {
  const { navigate, progress } = useApp();
  const parts = TOUR_PARTS.map((id) => COMPONENTS.find((c) => c.id === id)).filter((c): c is MotorComponent => c !== undefined);

  return (
    <Page id="overview">
      <ModelBadge kinds={['illustration', 'analytical']}>
        The drawings are idealised pictures, not to scale. The field demo uses a simplified two-winding model and the speed calculator is plain arithmetic. Parameters shown are examples, not data for a particular motor.
      </ModelBadge>

      <section className="panel intro-hero" aria-labelledby="ov-h">
        <div>
          <h2 id="ov-h">The motor that cannot start itself</h2>
          <Beginner>
            <p>
              A single-phase induction motor is the motor inside a ceiling fan, a water pump, a washing machine or a refrigerator compressor. It runs straight from a household socket, it has no brushes and no wires to the part that turns, and it is cheap and tough. It also
              has one odd habit that shapes its whole design: <strong>on its own it cannot start</strong>. This app shows you why, and how the different designs get round it.
            </p>
          </Beginner>
          <Detailed>
            <p>
              The motor has a laminated stator with a main winding (and usually an auxiliary winding) and a squirrel-cage rotor. A single winding makes a pulsating air-gap field, equivalent to two equal fields rotating in opposite directions. At standstill their torques
              cancel, so there is no starting torque; once the rotor turns, the forward field dominates and the motor can run. Practical motors therefore add a starting arrangement that creates a rotating component at start: a phase-shifted auxiliary winding (with a
              resistor or capacitor) or a shading ring.
            </p>
          </Detailed>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => navigate('explorer')}>
              Start with the 3D explorer →
            </button>
            <button type="button" className="btn" onClick={() => navigate('lab')}>
              Go to the Physics lab
            </button>
          </div>
        </div>
        <div>
          <h3>What you will be able to do</h3>
          <ul className="outcomes">
            {OUTCOMES.map((o) => (
              <li key={o.where}>
                {o.text}{' '}
                <button type="button" className="link" onClick={() => navigate(o.where)}>
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel" aria-labelledby="rt-h">
        <h2 id="rt-h">A suggested route</h2>
        <ol className="route">
          {STAGES.map((s, i) => (
            <li key={s.label}>
              <button type="button" className="route-btn" onClick={() => navigate(s.entry)}>
                <span className="chain-num" aria-hidden="true">
                  {i + 1}
                </span>
                <span>{s.label}</span>
                <small>{progress.visited.includes(s.entry) ? '✓ visited' : 'not visited yet'}</small>
              </button>
            </li>
          ))}
        </ol>
        <p className="muted small">
          The <strong>Beginner / Detailed</strong> switch in the top bar adds equations and assumptions. <strong>Pause animations</strong> stops all motion. Your progress and settings stay in this browser only.
        </p>
      </section>

      <EnergyChain />
      <PhaseDemo />
      <SpeedSlip />

      <section className="panel" aria-labelledby="pt-h">
        <div className="panel-head">
          <h2 id="pt-h">Meet the parts</h2>
          <button type="button" className="btn btn-primary" onClick={() => navigate('explorer')}>
            Open the 3D explorer →
          </button>
        </div>
        <p className="muted">The explorer has {COMPONENTS.length} components you can rotate, explode and inspect. Start with these six.</p>
        <ul className="parts-grid">
          {parts.map((c) => (
            <li key={c.id}>
              <button type="button" className="part-tile" onClick={() => navigate('explorer', { part: c.id })}>
                <strong>{c.name}</strong>
                <span>{c.tagline}</span>
                <small>Inspect in 3D →</small>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-labelledby="ap-h">
        <h2 id="ap-h">Where you meet them</h2>
        <p className="muted">Which type is fitted depends mainly on how hard the load is to start. These are typical examples, not a complete list.</p>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Starting method</th>
                <th scope="col">Typical uses</th>
              </tr>
            </thead>
            <tbody>
              {STARTING_METHODS.map((m) => (
                <tr key={m.id}>
                  <th scope="row">
                    <button type="button" className="link" onClick={() => navigate('starting', { starting: m.id })}>
                      {m.short}
                    </button>
                  </th>
                  <td>{m.uses.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </Page>
  );
}
