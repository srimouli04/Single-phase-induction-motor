import { useState, type RefObject } from 'react';
import { useAnimationFrame, useInView } from './useAnimationFrame';
import { useApp } from '../state';

/** Phase angle [rad] that advances at `hz` cycles per second while animations are on and `ref` is on screen. Frozen otherwise. */
export function useClock(ref: RefObject<Element | null>, hz = 0.6): number {
  const { motionOn } = useApp();
  const inView = useInView(ref);
  const [phase, setPhase] = useState(0);
  useAnimationFrame((dt) => setPhase((p) => (p + dt * 2 * Math.PI * hz) % (2 * Math.PI)), motionOn && inView);
  return phase;
}
