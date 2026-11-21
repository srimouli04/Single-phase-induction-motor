import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { Callout, ModelBadge } from '../components/Badges';
import { NumberSlider, ResetButton } from '../components/Controls';
import { FAULT_BY_ID, isFaultId, SAFETY_TEXT, SAFETY_TITLE } from '../content/faults';
import { applyFault, DEFAULT_SEVERITY, describeSeverity, hasSeverity, runFault, type FaultId, type FaultReport } from '../simulations/faults';
import { useApp } from '../state';
import { FaultAdvice, FaultCharts, FaultCompare, FaultFormulas, FaultHeader, FaultPicker, FaultStory } from './faults/FaultPanels';

const HEALTHY = runFault('none', 0); // the reference every scenario is compared with, computed once
const FIRST: FaultId = 'turn-short';
const startSeverity = (id: FaultId): number => DEFAULT_SEVERITY[id] ?? 1;

export default function Faults() {
  const { navigate, takeHandoff } = useApp();
  const [sel, setSel] = useState<{ id: FaultId; severity: number }>({ id: FIRST, severity: startSeverity(FIRST) });

  // Arrive from the Explorer's "What if it fails?" buttons with a scenario already chosen (consumed once; safe under StrictMode).
  useEffect(() => {
    const h = takeHandoff();
    if (h?.fault && isFaultId(h.fault)) setSel({ id: h.fault, severity: startSeverity(h.fault) });
  }, [takeHandoff]);

  const deferred = useDeferredValue(sel);
  const stale = deferred !== sel;
  const result = useMemo<{ r: FaultReport } | { error: string }>(() => {
    try {
      return { r: runFault(deferred.id, deferred.severity) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }, [deferred]);

  const f = FAULT_BY_ID[sel.id];
  const shown = FAULT_BY_ID[deferred.id];
  const choose = (id: FaultId) => setSel({ id, severity: startSeverity(id) });
  const reset = () => setSel({ id: sel.id, severity: startSeverity(sel.id) });

  return (
    <Page id="faults">
      <Callout tone="safety" title={SAFETY_TITLE}>
        {SAFETY_TEXT}
      </Callout>
      <ModelBadge kinds={['analytical', 'numerical', 'qualitative']}>
        Currents and torques come from the same equivalent-circuit model as the Physics lab. Heat, temperature and times come from a simplified three-part thermal model with illustrative values, and the damage stories are qualitative. Read them as trends, not
        predictions for a real motor.
      </ModelBadge>

      <div className="faults-layout">
        <aside className="faults-side" aria-label="Scenario choice and settings">
          <FaultPicker selected={sel.id} onSelect={choose} />
          <section className="panel" aria-labelledby="fset-h">
            <div className="panel-head">
              <h2 id="fset-h">Setting</h2>
              <ResetButton onClick={reset} label="Reset setting" />
            </div>
            {hasSeverity(sel.id) ? (
              <NumberSlider
                label={f.severityLabel ?? 'Severity'}
                unit="%"
                min={0}
                max={100}
                step={5}
                value={Math.round(sel.severity * 100)}
                onChange={(v) => setSel({ id: sel.id, severity: v / 100 })}
                hint={describeSeverity(sel.id, sel.severity)}
              />
            ) : (
              <p className="muted small">This scenario is either present or not, so it has no severity setting.</p>
            )}
            {f.inLab && (
              <button type="button" className="btn" onClick={() => navigate('lab', { lab: applyFault(sel.id, sel.severity).inputs })}>
                Open this fault in the Physics lab →
              </button>
            )}
          </section>
        </aside>

        <div className={`faults-main${stale ? ' is-stale' : ''}`} aria-busy={stale}>
          {'error' in result ? (
            <div className="state state-error" role="alert">
              <h3>This scenario could not be solved</h3>
              <p>{result.error}</p>
              <button type="button" className="btn" onClick={reset}>
                Reset the setting
              </button>
            </div>
          ) : (
            <>
              <FaultHeader f={shown} r={result.r} h={HEALTHY} />
              <FaultStory f={shown} onExplore={() => navigate('explorer', { part: shown.part })} />
              <FaultCompare r={result.r} h={HEALTHY} />
              <FaultCharts f={shown} r={result.r} h={HEALTHY} />
              <FaultAdvice f={shown} />
              <FaultFormulas id={shown.id} />
            </>
          )}
        </div>
      </div>
    </Page>
  );
}
