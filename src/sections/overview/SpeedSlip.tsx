import { useState } from 'react';
import { ModelBadge } from '../../components/Badges';
import { NumberSlider, ResetButton, Segmented } from '../../components/Controls';
import { Eq } from '../../components/Eq';
import { Readouts, type Reading } from '../../components/Readouts';
import { fmt } from '../../components/format';
import { POLE_OPTIONS, slipFromSpeeds, synchronousSpeedRpm } from '../../simulations/motorModel';
import { useApp } from '../../state';

const LOADED_SLIP = 0.03;

/** Synchronous speed and slip as plain arithmetic. Slip is the stored value, so changing f or P keeps the rotor the same fraction behind the field. */
export default function SpeedSlip() {
  const { navigate } = useApp();
  const [freq, setFreq] = useState(60);
  const [poles, setPoles] = useState(4);
  const [slip, setSlip] = useState(LOADED_SLIP);

  const ns = synchronousSpeedRpm(freq, poles);
  const nr = ns * (1 - slip);
  const items: Reading[] = [
    { label: 'Synchronous speed', term: 'syncSpeed', value: fmt(ns, 0), unit: 'rpm', hint: 'Speed of the rotating field' },
    { label: 'Rotor speed', term: 'rotorSpeed', value: fmt(nr, 0), unit: 'rpm' },
    { label: 'Slip', term: 'slip', value: fmt(slip * 100, 1), unit: '%', hint: `Rotor is ${fmt(ns - nr, 0)} rpm behind the field` },
    { label: 'Rotor current frequency', value: fmt(slip * freq, 1), unit: 'Hz', hint: slip > 0.99 ? 'Full supply frequency at standstill' : 'Only the slip speed sweeps across the bars: s × f' },
  ];

  return (
    <section className="panel" aria-labelledby="ss-h">
      <div className="panel-head">
        <h2 id="ss-h">Two numbers to remember: speed and slip</h2>
        <ResetButton
          onClick={() => {
            setFreq(60);
            setPoles(4);
            setSlip(LOADED_SLIP);
          }}
        />
      </div>
      <ModelBadge kinds={['analytical']}>Plain arithmetic from two textbook formulas. The Physics lab computes the speed a particular motor and load actually settle at.</ModelBadge>
      <div>
        <Eq block>{'N_s = 120 f / P'}</Eq>
        <Eq block>{'s = (N_s − N_r) / N_s'}</Eq>
      </div>
      <div className="demo-layout">
        <div className="demo-controls">
          <Segmented
            label="Supply frequency"
            value={freq}
            onChange={setFreq}
            options={[
              { value: 50, label: '50 Hz' },
              { value: 60, label: '60 Hz' },
            ]}
          />
          <Segmented label="Number of poles P" value={poles} onChange={setPoles} options={POLE_OPTIONS.map((n) => ({ value: n, label: String(n) }))} />
          <NumberSlider
            label="Rotor speed"
            term="rotorSpeed"
            unit="rpm"
            min={0}
            max={ns}
            step={1}
            value={nr}
            onChange={(v) => setSlip(slipFromSpeeds(ns, v))}
            hint="Slide to standstill (slip 100 %) or towards synchronous speed (slip 0, which a loaded motor never reaches)."
          />
          <div className="row">
            <button type="button" className="btn btn-sm" onClick={() => setSlip(1)}>
              At standstill
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setSlip(LOADED_SLIP)}>
              Running loaded (about 3 %)
            </button>
          </div>
        </div>
        <div className="demo-figs">
          <Readouts items={items} label="Speed and slip" />
          <p className="muted small">
            More poles make a slower field: 2 poles give 3600 rpm on 60 Hz, 8 poles only 900 rpm. A loaded motor runs a few percent below <Eq>N_s</Eq>, so a 4-pole, 60 Hz motor turns at about 1750 rpm. Slip is how far the rotor lags the field, as a fraction of <Eq>N_s</Eq>.
          </p>
          <button type="button" className="btn" onClick={() => navigate('lab')}>
            See the speed a real load settles at in the Physics lab →
          </button>
        </div>
      </div>
    </section>
  );
}
