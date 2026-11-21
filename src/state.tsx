import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocalStorage } from './hooks/useLocalStorage';
import { isSectionId, type SectionId } from './content/sections';
import type { LabInputs } from './simulations/motorModel';
import type { FieldInputs } from './simulations/field';

export type FieldMode = 'pulsating' | 'double' | 'twoWinding';

/** Configuration passed from one section to another (e.g. "Load experiment"). */
export interface Handoff {
  lab?: Partial<LabInputs>;
  labSpin?: number; // initial speed as a fraction of synchronous speed ("spin the shaft by hand")
  field?: { mode: FieldMode; inputs?: Partial<FieldInputs>; rotorSpeed?: number };
  starting?: string;
  fault?: string;
  /** Explorer: select this component and show it in context. */
  part?: string;
}

export interface Prefs {
  detail: 'beginner' | 'detailed';
  paused: boolean;
}
/** A student's answer to a guided experiment's prediction question, and how far they have got with it. */
export interface Prediction {
  choice: 'a' | 'b' | 'c' | null;
  phase: 'predict' | 'checked' | 'skipped';
}
export interface Progress {
  visited: string[];
  /** Ids of the experiments completed (the prediction was checked at least once). */
  experiments: string[];
  quiz: { best: number; total: number; attempts: number } | null;
  /** Per-experiment prediction state; absent in progress saved by older versions. */
  predictions?: Record<string, Prediction>;
}

const systemReducedMotion = (): boolean =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const parseHash = (): SectionId => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return isSectionId(h) ? h : 'overview';
};

interface AppState {
  section: SectionId;
  navigate: (id: SectionId, handoff?: Handoff) => void;
  takeHandoff: () => Handoff | null;
  prefs: Prefs;
  setDetail: (d: Prefs['detail']) => void;
  togglePaused: () => void;
  /** True when animations may run (user has not paused them and the system does not request reduced motion). */
  motionOn: boolean;
  progress: Progress;
  markExperiment: (id: string) => void;
  setPrediction: (id: string, p: Prediction) => void;
  recordQuiz: (score: number, total: number) => void;
  resetProgress: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [section, setSection] = useState<SectionId>(parseHash);
  const handoffRef = useRef<Handoff | null>(null);
  const [prefs, setPrefs] = useLocalStorage<Prefs>('splm.prefs', { detail: 'beginner', paused: systemReducedMotion() });
  const [progress, setProgress] = useLocalStorage<Progress>('splm.progress', { visited: [], experiments: [], quiz: null });

  useEffect(() => {
    const onHash = () => setSection(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    setProgress((p) => (p.visited.includes(section) ? p : { ...p, visited: [...p.visited, section] }));
    window.scrollTo({ top: 0 });
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [section, setProgress]);

  const navigate = useCallback((id: SectionId, handoff?: Handoff) => {
    handoffRef.current = handoff ?? null;
    if (window.location.hash === `#/${id}`) setSection(id);
    else window.location.hash = `#/${id}`;
  }, []);
  const takeHandoff = useCallback(() => {
    const h = handoffRef.current;
    handoffRef.current = null;
    return h;
  }, []);

  const value = useMemo<AppState>(
    () => ({
      section,
      navigate,
      takeHandoff,
      prefs,
      setDetail: (detail) => setPrefs((p) => ({ ...p, detail })),
      togglePaused: () => setPrefs((p) => ({ ...p, paused: !p.paused })),
      motionOn: !prefs.paused,
      progress,
      markExperiment: (id) => setProgress((p) => (p.experiments.includes(id) ? p : { ...p, experiments: [...p.experiments, id] })),
      setPrediction: (id, pred) => setProgress((p) => ({ ...p, predictions: { ...p.predictions, [id]: pred } })),
      recordQuiz: (score, total) =>
        setProgress((p) => ({ ...p, quiz: { best: Math.max(score, p.quiz?.best ?? 0), total, attempts: (p.quiz?.attempts ?? 0) + 1 } })),
      resetProgress: () => setProgress({ visited: [section], experiments: [], quiz: null }),
    }),
    [section, navigate, takeHandoff, prefs, progress, setPrefs, setProgress],
  );

  useEffect(() => {
    document.documentElement.dataset.motion = value.motionOn ? 'on' : 'off';
  }, [value.motionOn]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside <AppProvider>');
  return v;
}
