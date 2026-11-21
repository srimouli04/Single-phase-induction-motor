import { useEffect, useRef, useState, type RefObject } from 'react';

/** Calls `cb(dtSeconds)` every animation frame while `active`. Stops when the tab is hidden. */
export function useAnimationFrame(cb: (dt: number) => void, active: boolean): void {
  const ref = useRef(cb);
  ref.current = cb;
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); // cap: a long tab sleep must not become one huge step
      last = now;
      ref.current(dt);
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    };
    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) start();
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active]);
}

/** True while the referenced element is on screen (animations pause when scrolled away). */
export function useInView<T extends Element>(ref: RefObject<T | null>): boolean {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}
