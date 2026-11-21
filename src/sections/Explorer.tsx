import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Page, Loading } from '../components/Page';
import { Callout, ModelBadge } from '../components/Badges';
import { Eq } from '../components/Eq';
import { Detailed } from '../components/Level';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NumberSlider, ResetButton, Segmented, Toggle } from '../components/Controls';
import { COMPONENTS, COMPONENT_BY_ID, MODEL_NOTE, searchComponents } from '../content/components';
import { FAULT_BY_ID, FAULTS_FOR_PART } from '../content/faults';
import { SECTION_BY_ID, type SectionId } from '../content/sections';
import { useApp } from '../state';
import { useTween } from '../hooks/useTween';
import ComponentView2D from '../scenes/ComponentView2D';
import { LabelLayer } from '../scenes/LabelLayer';
import { webglAvailable } from '../scenes/webgl';
import type { PartId } from '../scenes/layout';
import type { SceneApi, ViewName } from '../scenes/MotorScene';

const MotorScene = lazy(() => import('../scenes/MotorScene'));

const MODES = [
  { value: 'assembled', label: 'Assembled', amount: 0 },
  { value: 'partial', label: 'Partial', amount: 0.5 },
  { value: 'full', label: 'Full', amount: 1 },
] as const;

const SEE_IN_ACTION: Record<PartId, SectionId> = {
  housing: 'faults',
  stator: 'field',
  mainWinding: 'field',
  auxWinding: 'field',
  capacitor: 'starting',
  rotor: 'lab',
  shaft: 'lab',
  airGap: 'lab',
  bearings: 'faults',
  endShields: 'faults',
  fan: 'faults',
  fanCover: 'faults',
  terminalBox: 'starting',
  centrifugalSwitch: 'starting',
};

const VIEWS: { name: ViewName; label: string }[] = [
  { name: 'iso', label: 'Angled' },
  { name: 'side', label: 'Side' },
  { name: 'end', label: 'Drive end' },
  { name: 'top', label: 'Top' },
];

const DEFAULTS = { explode: 0.5, labels: true, transparent: false, spin: true, spinSpeed: 3 };

export default function Explorer() {
  const { motionOn, navigate, takeHandoff } = useApp();
  const [explode, setExplode] = useState(DEFAULTS.explode);
  const [selected, setSelected] = useState<PartId | null>(null);
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [isolated, setIsolated] = useState<PartId | null>(null);
  const [context, setContext] = useState<PartId | null>(null);
  const [labels, setLabels] = useState(DEFAULTS.labels);
  const [transparent, setTransparent] = useState(DEFAULTS.transparent);
  const [spin, setSpin] = useState(DEFAULTS.spin);
  const [spinSpeed, setSpinSpeed] = useState(DEFAULTS.spinSpeed);
  const [query, setQuery] = useState('');
  const [hasGl] = useState(webglAvailable);
  const [view, setView] = useState<'3d' | '2d'>(hasGl ? '3d' : '2d');
  const [lost, setLost] = useState(false);
  const [sceneKey, setSceneKey] = useState(0);
  const api = useRef<SceneApi | null>(null);
  const [labelEls] = useState(() => new Map<string, HTMLElement>());

  const shown = useTween(explode, motionOn);
  const matches = useMemo(() => searchComponents(query), [query]);
  const current = selected ? COMPONENT_BY_ID[selected] : null;
  const number = (id: PartId) => COMPONENTS.findIndex((c) => c.id === id) + 1;
  const mode: string = MODES.find((m) => m.amount === explode)?.value ?? 'custom';

  const select = useCallback((id: PartId | null) => {
    setSelected(id);
    if (id === null) {
      setIsolated(null);
      setContext(null);
    } else {
      setContext((c) => (c ? id : c)); // the context and isolate views follow the selection
      setIsolated((i) => (i ? id : i));
    }
  }, []);

  // Arrive from the Faults page with a component already selected and shown in context (consumed once; safe under StrictMode).
  useEffect(() => {
    const part = takeHandoff()?.part;
    if (part && part in COMPONENT_BY_ID) {
      setSelected(part as PartId);
      setContext(part as PartId);
      setExplode(0);
    }
  }, [takeHandoff]);

  const showInContext = (id: PartId) => {
    setIsolated(null);
    setTransparent(false);
    setContext(id);
    setExplode(0);
    api.current?.focus(id);
  };
  const setAmount = (amount: number, refit: boolean) => {
    setExplode(amount);
    if (refit) api.current?.fit(amount);
  };
  const retry3d = () => {
    setLost(false);
    setSceneKey((k) => k + 1);
    setView('3d');
  };
  const resetAll = () => {
    setExplode(DEFAULTS.explode);
    setLabels(DEFAULTS.labels);
    setTransparent(DEFAULTS.transparent);
    setSpin(DEFAULTS.spin);
    setSpinSpeed(DEFAULTS.spinSpeed);
    setSelected(null);
    setIsolated(null);
    setContext(null);
    setQuery('');
    api.current?.view('iso', DEFAULTS.explode);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const a = api.current;
    if (!a || e.target !== e.currentTarget) return;
    const moves: Record<string, () => void> = {
      ArrowLeft: () => a.rotate(-10, 0),
      ArrowRight: () => a.rotate(10, 0),
      ArrowUp: () => a.rotate(0, -8),
      ArrowDown: () => a.rotate(0, 8),
      '+': () => a.zoom(0.85),
      '=': () => a.zoom(0.85),
      '-': () => a.zoom(1.18),
      Home: () => a.view('iso', explode),
      Escape: () => select(null),
    };
    const run = moves[e.key];
    if (run) {
      e.preventDefault();
      run();
    }
  };

  const sceneState = {
    explode: shown,
    selected,
    hovered,
    isolated,
    context,
    showLabels: labels,
    housingTransparent: transparent,
    onSelect: select,
    onHover: setHovered,
    labelEls,
  };
  const readout = hovered ?? selected;
  const cam = (label: string, text: string, run: () => void) => (
    <button type="button" className="btn btn-sm btn-ghost" aria-label={label} onClick={run}>
      {text}
    </button>
  );

  return (
    <Page id="explorer">
      <div className="explorer">
        <div className="explorer-main">
          <div className="panel tools">
            <div className="tool-row">
              <Segmented
                label="Explode preset"
                hideLabel
                value={mode}
                options={MODES.map((m) => ({ value: m.value as string, label: m.label }))}
                onChange={(v) => setAmount(MODES.find((m) => m.value === v)?.amount ?? 0, true)}
              />
              <NumberSlider label="Explode amount" value={Math.round(explode * 100)} min={0} max={150} step={1} unit="%" onChange={(v) => setAmount(v / 100, false)} />
              <Segmented
                label="View"
                hideLabel
                value={view}
                options={[
                  { value: '3d', label: '3D', title: hasGl ? '3D view (WebGL)' : 'Not available: WebGL is off or unsupported in this browser' },
                  { value: '2d', label: '2D cut-away', title: 'Flat cut-away drawing (works without WebGL)' },
                ]}
                onChange={(v) => (v === '3d' ? retry3d() : setView(v))}
              />
            </div>
          </div>

          {!hasGl && view === '2d' && (
            <p className="state state-note" role="status">
              3D is unavailable in this browser (WebGL is disabled or unsupported), so the 2D cut-away view is shown. Everything else works the same.
            </p>
          )}
          {lost && (
            <p className="state state-error" role="alert">
              The graphics context was lost, so the 2D view is shown.{' '}
              <button type="button" className="btn btn-sm" onClick={retry3d}>
                Try 3D again
              </button>
            </p>
          )}

          <div
            className="scene-wrap"
            role="group"
            aria-label={view === '3d' ? '3D motor view. Arrow keys rotate, plus and minus zoom, Home resets the camera.' : '2D motor view'}
            tabIndex={view === '3d' ? 0 : undefined}
            onKeyDown={onKey}
          >
            {view === '3d' ? (
              <ErrorBoundary
                label="the 3D view"
                fallback={(err) => (
                  <div className="state state-error" role="alert">
                    <h3>The 3D view could not start</h3>
                    <p>{err.message}</p>
                    <button type="button" className="btn" onClick={() => setView('2d')}>
                      Use the 2D view
                    </button>
                  </div>
                )}
              >
                <Suspense fallback={<Loading what="3D model" />}>
                  <MotorScene
                    key={sceneKey}
                    state={sceneState}
                    spin={spin}
                    spinSpeed={spinSpeed}
                    motionOn={motionOn}
                    apiRef={api}
                    initialExplode={DEFAULTS.explode}
                    onContextLost={() => {
                      setLost(true);
                      setView('2d');
                    }}
                  />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <ComponentView2D state={sceneState} />
            )}
            {view === '3d' && labels && <LabelLayer els={labelEls} isolated={isolated} selected={selected} onSelect={select} onHover={setHovered} />}
            <p className="scene-readout" aria-hidden="true">
              {readout ? (
                <>
                  <strong>{COMPONENT_BY_ID[readout].name}</strong>
                  <span>{hovered && hovered !== selected ? ' · click to select' : ' · selected'}</span>
                </>
              ) : (
                <span>Hover or tap a component</span>
              )}
            </p>
          </div>

          <div className="panel tools">
            <div className="tool-row tool-toggles">
              <Toggle label="Labels" checked={labels} onChange={setLabels} />
              <Toggle
                label="Transparent housing"
                checked={transparent}
                onChange={(v) => {
                  setTransparent(v);
                  if (v) setContext(null);
                }}
              />
              <Toggle
                label="Isolate selected"
                checked={isolated !== null}
                disabled={!selected}
                hint={selected ? 'Hide every other component' : 'Select a component first'}
                onChange={(on) => {
                  setIsolated(on ? selected : null);
                  if (on) setContext(null);
                }}
              />
              <Toggle label="Spin rotor" checked={spin} onChange={setSpin} hint="Spins the rotor and shaft independently of the explode setting" disabled={view === '2d'} />
              {spin && view === '3d' && (
                <NumberSlider label="Spin speed (visual only)" value={spinSpeed} min={0.5} max={12} step={0.5} unit="rad/s" onChange={setSpinSpeed} hint={motionOn ? undefined : 'Animations are paused (top bar or system setting).'} />
              )}
            </div>
            <div className="tool-row tool-camera" role="group" aria-label="Camera and reset">
              {view === '3d' && (
                <>
                  <button type="button" className="btn btn-sm" onClick={() => api.current?.view('iso', explode)}>
                    Reset camera
                  </button>
                  {VIEWS.map((v) => (
                    <button key={v.name} type="button" className="btn btn-sm btn-ghost" onClick={() => api.current?.view(v.name, explode)}>
                      {v.label}
                    </button>
                  ))}
                  <span className="tool-sep" aria-hidden="true" />
                  {cam('Rotate left', '◀', () => api.current?.rotate(-15, 0))}
                  {cam('Rotate right', '▶', () => api.current?.rotate(15, 0))}
                  {cam('Tilt up', '▲', () => api.current?.rotate(0, -10))}
                  {cam('Tilt down', '▼', () => api.current?.rotate(0, 10))}
                  {cam('Zoom in', '＋', () => api.current?.zoom(0.82))}
                  {cam('Zoom out', '－', () => api.current?.zoom(1.22))}
                  <span className="tool-sep" aria-hidden="true" />
                </>
              )}
              <ResetButton onClick={resetAll} label="Reset everything" />
              {context && (
                <button type="button" className="btn btn-sm" onClick={() => setContext(null)}>
                  Leave context view
                </button>
              )}
            </div>
          </div>
          <p className="scene-help">
            {view === '3d' ? 'Drag to rotate · right-drag or two fingers to pan · wheel or pinch to zoom · click or tap a part. ' : 'Click or tap a part, or tab to it. Numbered badges match the list. '}
            Keyboard: focus the view, then arrow keys rotate and + / − zoom.
          </p>
          <ModelBadge kinds={['illustration']}>One representative capacitor-start motor, drawn procedurally. Proportions and the air gap are exaggerated.</ModelBadge>
        </div>

        <aside className="explorer-side" aria-label="Component details and list">
          {current ? (
            <section className="panel info" aria-labelledby="info-title">
              <p className="sr-only" role="status">
                Selected {current.name}
              </p>
              <header className="info-head">
                <span className="num" aria-hidden="true">
                  {number(current.id)}
                </span>
                <h2 id="info-title">{current.name}</h2>
              </header>
              <p className="tagline">{current.tagline}</p>
              <p>
                <span className="pill">{current.internal ? 'Hidden inside the housing' : 'Visible from outside'}</span>
              </p>
              <dl className="facts">
                <dt>Function</dt>
                <dd>{current.function}</dd>
                <dt>Material</dt>
                <dd>{current.material}</dd>
                <dt>Interacts with</dt>
                <dd>{current.interactions}</dd>
                <dt>Typical failure</dt>
                <dd>{current.failure}</dd>
              </dl>
              {current.note && (
                <Callout tone="warning" title="Not every motor is like this">
                  {current.note}
                </Callout>
              )}
              <div className="actions">
                <button type="button" className="btn btn-primary" onClick={() => showInContext(current.id)}>
                  Show in context
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setIsolated(isolated === current.id ? null : current.id);
                    setContext(null);
                  }}
                >
                  {isolated === current.id ? 'Show all parts' : 'Isolate'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => select(null)}>
                  Clear
                </button>
              </div>
              <p>
                <button type="button" className="link" onClick={() => navigate(SEE_IN_ACTION[current.id])}>
                  See it in action: {SECTION_BY_ID[SEE_IN_ACTION[current.id]].title} →
                </button>
              </p>
              <div className="whatif">
                <h3>What if it fails?</h3>
                <ul>
                  {FAULTS_FOR_PART[current.id].map((id) => (
                    <li key={id}>
                      <button type="button" className="link" onClick={() => navigate('faults', { fault: id })}>
                        {FAULT_BY_ID[id].title} →
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <section className="panel info info-empty" aria-label="Component details">
              <h2>Select a component</h2>
              <p>Click a part in the view, or pick one from the list, to see what it does, what it is made of, what it touches and how it fails.</p>
              <ul className="tips">
                <li>
                  Press <strong>Full</strong> to pull the motor apart; the rotor slides out of the stator.
                </li>
                <li>
                  <strong>Show in context</strong> reassembles the motor and fades everything except your part.
                </li>
                <li>
                  <strong>Transparent housing</strong> reveals the stator, windings and rotor inside.
                </li>
              </ul>
            </section>
          )}

          <div className="panel list-panel">
            <label className="search" htmlFor="comp-search">
              <span className="sr-only">Search components</span>
              <input id="comp-search" type="search" placeholder="Search components (e.g. copper, bearing, start)" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <p className="list-count" role="status">
              {matches.length === 0 ? `No component matches “${query}”.` : `${matches.length} of ${COMPONENTS.length} components`}
            </p>
            {matches.length === 0 && (
              <button type="button" className="btn btn-sm" onClick={() => setQuery('')}>
                Clear search
              </button>
            )}
            <ul className="comp-list">
              {matches.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`comp-item${selected === c.id ? ' on' : ''}`}
                    aria-pressed={selected === c.id}
                    onClick={() => select(c.id)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(c.id)}
                    onBlur={() => setHovered(null)}
                  >
                    <span className="num" aria-hidden="true">
                      {number(c.id)}
                    </span>
                    <span className="comp-text">
                      <strong>{c.name}</strong>
                      <small>{c.tagline}</small>
                    </span>
                    {c.internal && (
                      <span className="pill" title="Hidden inside the housing when assembled">
                        inside
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <Callout tone="note" title="About this model">
        {MODEL_NOTE}
      </Callout>
      <Detailed>
        <p>
          The stator is drawn with 24 slots. The main-winding groups sit on the pole axes and the auxiliary groups sit half a pole pitch away, which is 90 electrical degrees (45 mechanical degrees in a 4-pole motor). The auxiliary winding is drawn with thinner wire because in a capacitor-start motor it carries current only briefly. Synchronous speed follows <Eq>N_s = 120 f / P</Eq>, so the same frame wound for 2, 4 or 6 poles would have a synchronous speed of 3600, 1800 or 1200 rpm on a 60 Hz supply.
        </p>
      </Detailed>
    </Page>
  );
}
