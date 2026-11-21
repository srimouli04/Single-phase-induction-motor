import { Eq } from '../../components/Eq';
import { Detailed } from '../../components/Level';
import { Readouts, type Reading } from '../../components/Readouts';
import { fmt, fmtInt, fmtPct } from '../../components/format';
import { lineCurrent, OUTCOME_TEXT, turnsInReverse, type LabSummary } from '../../simulations/metrics';
import { EXAMPLE_MOTOR, radPerSecToRpm } from '../../simulations/motorModel';

const TONE_CLASS = { ok: 'pill pill-ok', warn: 'pill pill-warn', bad: 'pill pill-bad' } as const;
const TONE_MARK = { ok: '✔', warn: '!', bad: '✖' } as const;

export function LabReadouts({ s }: { s: LabSummary }) {
  const o = OUTCOME_TEXT[s.startup.outcome];
  const rpm = Math.abs(radPerSecToRpm(s.startup.finalOmega));
  const slip = s.running ? 1 - rpm / s.nsRpm : null;
  const speedHint = turnsInReverse(s) ? 'Turning in reverse (shown without a sign)' : s.running && s.startup.outcome !== 'settles' ? 'Not steady: the speed at the end of the run' : undefined;
  const items: Reading[] = [
    { label: 'Synchronous speed', term: 'syncSpeed', value: fmtInt(s.nsRpm), unit: 'rpm' },
    { label: 'Rotor speed', term: 'rotorSpeed', value: s.running ? fmtInt(rpm) : '0', unit: 'rpm', hint: speedHint },
    { label: 'Slip', term: 'slip', value: slip === null ? '–' : fmtPct(slip, 1), unit: slip === null ? '' : '%' },
    { label: 'Time to 90 % speed', value: s.startup.timeToSpeed === null ? '–' : fmt(s.startup.timeToSpeed, 2), unit: s.startup.timeToSpeed === null ? '' : 's' },
    { label: 'Starting torque', term: 'startingTorque', value: fmt(s.startTorque, 2), unit: 'N·m', hint: s.inputs.loadTorque > 0 ? `Load: ${fmt(s.inputs.loadTorque, 2)} N·m` : undefined },
    { label: 'Starting current', term: 'lockedRotorCurrent', value: fmt(s.startCurrent, 1), unit: 'A' },
    { label: s.running ? 'Running current' : 'Current while stuck', value: fmt(lineCurrent(s.run), 1), unit: 'A' },
    { label: 'Power factor', term: 'powerFactor', value: fmt(s.run.powerFactor, 2), hint: 'Lagging' },
    { label: 'Input power', value: fmtInt(s.run.inputPower), unit: 'W' },
    { label: 'Shaft output', value: fmtInt(s.outputPower), unit: 'W' },
    { label: 'Efficiency (estimate)', value: s.efficiency === null ? '–' : fmtPct(s.efficiency, 0), unit: s.efficiency === null ? '' : '%', hint: 'Ignores iron and windage loss' },
    { label: 'Winding copper loss', value: fmtInt(s.run.statorCopperLoss + s.run.rotorCopperLoss), unit: 'W', hint: `Stator ${fmtInt(s.run.statorCopperLoss)} · rotor ${fmtInt(s.run.rotorCopperLoss)}` },
    { label: 'Breakdown torque', term: 'breakdownTorque', value: fmt(s.breakdown.torque, 2), unit: 'N·m', hint: `at ${fmtInt(s.breakdown.speedRpm)} rpm` },
    { label: 'Overload margin', value: s.overloadMargin === null ? '–' : fmt(s.overloadMargin, 1), unit: s.overloadMargin === null ? '' : '×', hint: 'Breakdown ÷ load' },
  ];
  return (
    <section className="panel" aria-labelledby="readouts-h">
      <div className="panel-head">
        <h2 id="readouts-h">Results</h2>
        <span className={TONE_CLASS[o.tone]} title={o.detail}>
          <span aria-hidden="true">{TONE_MARK[o.tone]}</span> {o.label}
        </span>
      </div>
      <p className="muted small" role="status">
        {o.detail}
      </p>
      <Readouts items={items} label="Computed results" />
    </section>
  );
}

export function LabFormulas({ s }: { s: LabSummary }) {
  const { inputs, run, start } = s;
  const rpm = Math.abs(radPerSecToRpm(s.startup.finalOmega));
  const xc = inputs.capacitanceUF > 0 ? 1e6 / (2 * Math.PI * inputs.frequencyHz * inputs.capacitanceUF) : null;
  const hasCap = inputs.method === 'capacitor-start' || inputs.method === 'psc';
  const at = s.running ? run : start;
  return (
    <section className="panel" aria-labelledby="formulas-h">
      <h2 id="formulas-h">The equations behind the numbers</h2>
      <div className="formula-list">
        <div>
          <Eq block>N_s = 120 f / P</Eq>
          <p className="formula-live">
            = 120 × {inputs.frequencyHz} ÷ {inputs.poles} = <strong>{fmtInt(s.nsRpm)} rpm</strong>
          </p>
        </div>
        <div>
          <Eq block>s = (N_s − N_r) / N_s</Eq>
          <p className="formula-live">
            {s.running ? (
              <>
                = ({fmtInt(s.nsRpm)} − {fmtInt(rpm)}) ÷ {fmtInt(s.nsRpm)} = <strong>{fmt(1 - rpm / s.nsRpm, 3)}</strong>
              </>
            ) : (
              <>
                = ({fmtInt(s.nsRpm)} − 0) ÷ {fmtInt(s.nsRpm)} = <strong>1.000</strong> (standstill)
              </>
            )}
          </p>
        </div>
        <div>
          <Eq block>{'T_{net} = T_f − T_b'}</Eq>
          <p className="formula-live">
            {s.running ? 'At the operating point' : 'At standstill'}: {fmt(at.torqueF, 2)} − {fmt(at.torqueB, 2)} = <strong>{fmt(at.torqueNet, 2)} N·m</strong>
          </p>
          <p className="muted small">The forward field has slip s, the backward field has slip 2 − s ({fmt(2 - at.slip, 3)} here).</p>
        </div>
        {hasCap && xc !== null && (
          <div>
            <Eq block>X_c = 1 / (2π f C)</Eq>
            <p className="formula-live">
              = 1 ÷ (2π × {inputs.frequencyHz} × {inputs.capacitanceUF}×10⁻⁶) = <strong>{fmt(xc, 1)} Ω</strong>
            </p>
          </div>
        )}
        <div>
          <Eq block>{'J dω/dt = T_{motor} − T_{load} − B ω'}</Eq>
          <p className="muted small">Integrated numerically (4th-order Runge-Kutta) to draw the speed-time curve.</p>
        </div>
      </div>
      <Detailed>
        <p>
          Torque comes from the air-gap power of each rotating field: <Eq>T_f = 2 R_F |I_f|² / ω_s</Eq> and <Eq>T_b = 2 R_B |I_b|² / ω_s</Eq>, where <Eq>R_F</Eq> and <Eq>R_B</Eq> are the real parts of the forward and backward rotor-side impedances and <Eq>ω_s = 4π f / P</Eq>. With only the main winding, <Eq>I_f = I_b = I_m / 2</Eq>; with an auxiliary winding the two sequence currents are found from <Eq>V_f = (Z_s + Z_F) I_f + Z_d I_b</Eq> and <Eq>V_b = Z_d I_f + (Z_s + Z_B) I_b</Eq>.
        </p>
      </Detailed>
    </section>
  );
}

const PARAMS: { symbol: string; value: string; meaning: string }[] = [
  { symbol: 'r_1m', value: `${EXAMPLE_MOTOR.r1m} Ω`, meaning: 'Main-winding resistance' },
  { symbol: 'x_1m', value: `${EXAMPLE_MOTOR.x1m} Ω`, meaning: 'Main-winding leakage reactance at 60 Hz' },
  { symbol: 'x_m', value: `${EXAMPLE_MOTOR.xm} Ω`, meaning: 'Magnetising reactance at 60 Hz' },
  { symbol: 'r_2', value: `${EXAMPLE_MOTOR.r2} Ω`, meaning: 'Rotor resistance referred to the main winding' },
  { symbol: 'x_2', value: `${EXAMPLE_MOTOR.x2} Ω`, meaning: 'Rotor leakage reactance at 60 Hz, referred' },
  { symbol: 'r_1a', value: `${EXAMPLE_MOTOR.r1a} Ω`, meaning: 'Auxiliary-winding resistance' },
  { symbol: 'x_1a', value: `${EXAMPLE_MOTOR.x1a} Ω`, meaning: 'Auxiliary-winding leakage reactance at 60 Hz' },
  { symbol: 'a', value: `${EXAMPLE_MOTOR.turnsRatio}`, meaning: 'Auxiliary-to-main effective turns ratio' },
];

export function ModelDetails() {
  return (
    <details className="panel model-details">
      <summary>
        <strong>Model details:</strong> what is drawn, what is derived, what is assumed
      </summary>
      <div className="grid-3 model-kinds">
        <div>
          <h3>Illustration</h3>
          <p>The 3D motor, the 2D cut-away and the field arrows are drawings. Shapes, spin speeds and the air gap are exaggerated and carry no measurements.</p>
        </div>
        <div>
          <h3>Analytical model</h3>
          <p>
            Torque, current, power factor and losses come from the standard <strong>double-revolving-field equivalent circuit</strong>, solved exactly for any speed with symmetrical components when an auxiliary winding is present.
          </p>
        </div>
        <div>
          <h3>Numerical calculation</h3>
          <p>
            Speed against time is a numerical (Runge-Kutta) integration of <Eq>{'J dω/dt = T_{motor} − T_{load} − B ω'}</Eq> using the analytical torque, with the centrifugal switch modelled as a speed-triggered switch with hysteresis.
          </p>
        </div>
      </div>
      <h3>Assumptions</h3>
      <ul>
        <li>Parameters are constant: no magnetic saturation, no skin effect in the rotor bars, no temperature change.</li>
        <li>Reactances scale in proportion to frequency; resistances do not.</li>
        <li>Iron loss, windage and bearing loss are not modelled (only viscous friction B and the load torque). The efficiency shown is therefore an upper estimate.</li>
        <li>Electrical transients are ignored: currents are the steady-state phasor values at the instantaneous speed (quasi-static). Torque pulsation at twice the supply frequency is not shown.</li>
        <li>The load is a constant torque opposing rotation. Real fans, pumps and compressors have different torque-speed shapes.</li>
        <li>
          Speeds are limited to the range −<Eq>N_s</Eq> to +<Eq>N_s</Eq>.
        </li>
      </ul>
      <h3>Example motor parameters</h3>
      <p className="muted small">
        Illustrative values of the right order for a small 120 V, 60 Hz, 4-pole motor (about a quarter of a horsepower). They are <strong>not</strong> from a datasheet, and real motors vary widely.
      </p>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Value</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {PARAMS.map((p) => (
              <tr key={p.symbol}>
                <td>
                  <Eq>{p.symbol}</Eq>
                </td>
                <td>{p.value}</td>
                <td>{p.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
