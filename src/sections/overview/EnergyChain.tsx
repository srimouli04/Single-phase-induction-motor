import { useRef, useState } from 'react';
import { Callout } from '../../components/Badges';
import { Eq, Rich } from '../../components/Eq';
import { Detailed } from '../../components/Level';
import { useClock } from '../../hooks/useClock';
import { Glyph } from './ChainGlyphs';
import { CHAIN, WT0, type ChainStage } from './chain';

/** Six-stage walk from the socket to the shaft. One clock drives every drawing; the selected stage is highlighted and explained below. */
export default function EnergyChain() {
  const ref = useRef<HTMLElement>(null);
  const wt = useClock(ref, 0.45) + WT0;
  const [step, setStep] = useState(0);
  const cur = CHAIN[step];

  const card = (s: ChainStage, i: number) => (
    <li key={s.id}>
      <button type="button" className="chain-card" aria-current={i === step ? 'step' : undefined} aria-label={`Step ${i + 1} of ${CHAIN.length}: ${s.title}`} onClick={() => setStep(i)}>
        <span className="chain-title">
          <span className="chain-num" aria-hidden="true">
            {i + 1}
          </span>
          {s.title}
        </span>
        <svg viewBox="0 0 200 140" aria-hidden="true" focusable="false">
          <Glyph id={s.id} wt={wt} />
        </svg>
        <span className="chain-tag">{s.tag}</span>
      </button>
    </li>
  );
  const stator = CHAIN.filter((s) => s.side === 'stator');
  const rotor = CHAIN.filter((s) => s.side === 'rotor');

  return (
    <section ref={ref} className="panel" aria-labelledby="ch-h">
      <div className="panel-head">
        <h2 id="ch-h">From the socket to the shaft</h2>
        <div className="row">
          <button type="button" className="btn btn-sm" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            ← Previous
          </button>
          <span className="small muted" aria-hidden="true">
            Step {step + 1} of {CHAIN.length}
          </span>
          <button type="button" className="btn btn-sm btn-primary" disabled={step === CHAIN.length - 1} onClick={() => setStep((s) => Math.min(CHAIN.length - 1, s + 1))}>
            Next →
          </button>
        </div>
      </div>
      <p className="muted small">Energy flows along each row and then through the air gap into the rotor. Select a step to read about it. Every drawing is animated and slowed down so that you can follow it.</p>

      <div className="chain-detail" aria-live="polite">
        <h3>
          <span className="chain-num" aria-hidden="true">
            {step + 1}
          </span>
          {cur.title}
        </h3>
        <p>{cur.text}</p>
        <Detailed>
          <Eq block>{cur.eq}</Eq>
          <p className="muted small">
            <Rich>{cur.eqNote}</Rich>
          </p>
        </Detailed>
      </div>

      <div className="chain">
        <div className="chain-group">
          <h3 className="chain-side">Stator: wired to the supply</h3>
          <ol className="chain-steps">{stator.map((s) => card(s, CHAIN.indexOf(s)))}</ol>
        </div>
        <div className="chain-gap" role="note">
          <span className="chain-gap-line" aria-hidden="true" />
          <span className="chain-gap-label">Air gap: the field crosses, no wire does</span>
          <span className="chain-gap-line" aria-hidden="true" />
        </div>
        <div className="chain-group">
          <h3 className="chain-side">Rotor: no electrical connection</h3>
          <ol className="chain-steps" start={4}>
            {rotor.map((s) => card(s, CHAIN.indexOf(s)))}
          </ol>
        </div>
      </div>

      <Callout tone="note" title="Why “induction”: nothing is connected to the rotor">
        The stator is wired to the supply. The rotor is a closed cage of bars with no wires, brushes or slip rings: energy reaches it only through the changing magnetic field, the way a transformer’s secondary gets its power from the primary. That is why the
        motor is simple and robust, and also why the rotor must always turn a little slower than the field (stage 6).
      </Callout>
    </section>
  );
}
