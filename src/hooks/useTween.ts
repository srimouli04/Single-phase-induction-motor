import { useEffect, useRef, useState } from 'react';
import { useAnimationFrame } from './useAnimationFrame';

/** Smoothly follows `target` (exponential easing). Jumps straight to it when animation is off. */
export function useTween(target: number, animate: boolean, rate = 7): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  const moving = animate && Math.abs(target - value) > 0.0005;

  useAnimationFrame((dt) => {
    const d = target - current.current;
    current.current = Math.abs(d) < 0.0005 ? target : current.current + d * Math.min(1, dt * rate);
    setValue(current.current);
  }, moving);

  useEffect(() => {
    if (!animate && current.current !== target) {
      current.current = target;
      setValue(target);
    }
  }, [animate, target]);

  return value;
}
