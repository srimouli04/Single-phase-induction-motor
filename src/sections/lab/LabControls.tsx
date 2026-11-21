import { NumberSlider, ResetButton, Segmented, Toggle } from '../../components/Controls';
import { LIMITS, POLE_OPTIONS, START_METHODS, synchronousSpeedRpm, type LabInputs, type StartMethod, type SwitchFault } from '../../simulations/motorModel';

interface Props {
  inputs: LabInputs;
  onChange: (patch: Partial<LabInputs>) => void;
  onMethod: (m: StartMethod) => void;
  onReset: () => void;
  startFraction: number;
  onStartFraction: (v: number) => void;
  /** Messages from validation (values that were clamped or repaired). */
  issues: string[];
}

/** All lab inputs, grouped. Every control is a labelled native input; typed values are clamped with a visible message. */
export function LabControls({ inputs, onChange, onMethod, onReset, startFraction, onStartFraction, issues }: Props) {
  const hasCircuit = inputs.method !== 'main-only';
  const usesSwitch = inputs.method === 'split-phase' || inputs.method === 'capacitor-start';
  const ns = synchronousSpeedRpm(inputs.frequencyHz, inputs.poles);

  return (
    <div className="panel lab-controls">
      <div className="panel-head">
        <h2>Controls</h2>
        <ResetButton onClick={onReset} label="Reset all" />
      </div>
      {issues.length > 0 && (
        <ul className="issues" role="status">
          {issues.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <fieldset className="group">
        <legend>Supply</legend>
        <NumberSlider label="Frequency" term="frequency" unit="Hz" {...LIMITS.frequencyHz} value={inputs.frequencyHz} onChange={(v) => onChange({ frequencyHz: v })} />
        <NumberSlider label="Supply voltage" unit="V rms" {...LIMITS.voltage} value={inputs.voltage} onChange={(v) => onChange({ voltage: v })} />
        <Segmented label="Number of poles" options={POLE_OPTIONS.map((p) => ({ value: p, label: String(p) }))} value={inputs.poles} onChange={(v) => onChange({ poles: v })} />
        <p className="ctl-hint">Synchronous speed: {ns.toFixed(0)} rpm</p>
      </fieldset>

      <fieldset className="group">
        <legend>Load and rotor</legend>
        <NumberSlider label="Load torque" term="loadTorque" unit="N·m" {...LIMITS.loadTorque} value={inputs.loadTorque} onChange={(v) => onChange({ loadTorque: v })} hint="Constant torque opposing rotation (e.g. a fan or pump at one operating point)." />
        <NumberSlider label="Rotor and load inertia" term="rotorInertia" unit="kg·m²" {...LIMITS.inertia} decimals={3} value={inputs.inertia} onChange={(v) => onChange({ inertia: v })} />
        <NumberSlider label="Viscous friction" term="damping" unit="N·m·s/rad" {...LIMITS.damping} decimals={4} value={inputs.damping} onChange={(v) => onChange({ damping: v })} />
      </fieldset>

      <fieldset className="group">
        <legend>Starting circuit</legend>
        <div className="ctl">
          <label htmlFor="lab-method">Starting method</label>
          <select id="lab-method" value={inputs.method} onChange={(e) => onMethod(e.target.value as StartMethod)}>
            {START_METHODS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {inputs.method === 'split-phase' && (
          <NumberSlider label="Auxiliary-branch resistance" unit="Ω" {...LIMITS.auxResistance} value={inputs.auxResistance} onChange={(v) => onChange({ auxResistance: v })} hint="Total series resistance of the starting branch. More resistance means less phase shift is lost to reactance." />
        )}
        {(inputs.method === 'capacitor-start' || inputs.method === 'psc') && (
          <NumberSlider label={inputs.method === 'psc' ? 'Run capacitor' : 'Start capacitor'} term="capacitor" unit="µF" {...LIMITS.capacitanceUF} value={inputs.capacitanceUF} onChange={(v) => onChange({ capacitanceUF: v })} />
        )}
        {usesSwitch && (
          <NumberSlider
            label="Switch opens at"
            term="centrifugalSwitch"
            unit="% of N_s"
            min={LIMITS.cutoutFraction.min * 100}
            max={LIMITS.cutoutFraction.max * 100}
            step={1}
            value={Math.round(inputs.cutoutFraction * 100)}
            onChange={(v) => onChange({ cutoutFraction: v / 100 })}
            hint="The switch re-closes if the speed falls 10 % of N_s below this."
          />
        )}
        {hasCircuit && <Toggle label="Swap auxiliary leads (reverses direction)" checked={inputs.auxReversed} onChange={(v) => onChange({ auxReversed: v })} />}
        <NumberSlider label="Initial speed (spin the shaft by hand)" unit="% of N_s" min={0} max={100} step={5} value={Math.round(startFraction * 100)} onChange={(v) => onStartFraction(v / 100)} hint="Try a main-winding-only motor: it will not start from rest, but keeps running if you give it a push." />
      </fieldset>

      <details className="group faults-group" open={inputs.auxOpen || inputs.switchFault !== 'none' || inputs.rotorLocked}>
        <summary>Fault switches</summary>
        <div className="stack">
          <Toggle label="Auxiliary branch open-circuit" checked={inputs.auxOpen} onChange={(v) => onChange({ auxOpen: v })} disabled={!hasCircuit} />
          <Segmented
            label="Centrifugal switch"
            options={[
              { value: 'none' as SwitchFault, label: 'Normal' },
              { value: 'stuck-open' as SwitchFault, label: 'Stuck open' },
              { value: 'stuck-closed' as SwitchFault, label: 'Stuck closed' },
            ]}
            value={inputs.switchFault}
            onChange={(v) => onChange({ switchFault: v })}
          />
          {!usesSwitch && hasCircuit && <p className="ctl-hint">A permanent-capacitor motor has no starting switch, so this setting has no effect.</p>}
          <Toggle label="Rotor locked (jammed)" checked={inputs.rotorLocked} onChange={(v) => onChange({ rotorLocked: v })} />
        </div>
      </details>
    </div>
  );
}
