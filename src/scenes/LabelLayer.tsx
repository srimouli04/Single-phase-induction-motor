import { useEffect, useRef, type RefObject } from 'react';
import { declutter, type LabelSpec } from '../components/chartMath';
import { LABEL_AT, LABEL_TEXT, type PartId } from './layout';

interface Props {
  /** Registry the 3D scene positions (see LabelProbe in parts.tsx). */
  els: Map<string, HTMLElement>;
  isolated: PartId | null;
  selected: PartId | null;
  onSelect: (id: PartId) => void;
  onHover: (id: PartId | null) => void;
}

/**
 * Keeps the labels from covering each other. The scene puts each label on its 3D anchor (CSS `transform`, data-x / data-y);
 * this loop moves overlapping ones up or down with the separate CSS `translate` property. The selected label is placed
 * first so it stays put, the rest in key order so labels do not trade places while the camera moves.
 */
function useLabelDeclutter(els: Map<string, HTMLElement>, root: RefObject<HTMLDivElement | null>, selected: PartId | null) {
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const shown = [...els.entries()]
        .filter(([, el]) => el.style.visibility === 'visible' && el.dataset.x !== undefined)
        .sort(([a], [b]) => (a.split(':')[0] === selected ? -1 : b.split(':')[0] === selected ? 1 : a < b ? -1 : 1));
      const boxes = shown.map(([, el]) => ({ el, w: el.offsetWidth, h: el.offsetHeight })); // all reads before any write
      const height = root.current?.clientHeight ?? 0;
      const specs: LabelSpec[] = boxes.map(({ el, w, h }) => ({ x: Number(el.dataset.x) - w / 2, y: Number(el.dataset.y) + h / 2 - 3, w, h, anchor: 'start' }));
      const step = Math.max(0, ...boxes.map((b) => b.h)) + 3;
      const dy = declutter(specs, [], height > 0 ? [0, height] : undefined, step, 10); // end-on camera views stack all 16 labels in one spot
      boxes.forEach(({ el }, i) => {
        const next = dy[i] ? `0 ${dy[i]}px` : '';
        if (el.style.translate !== next) el.style.translate = next;
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [els, root, selected]);
}

/** Page-level label buttons overlaying the canvas. Hidden until the scene has positioned them. */
export function LabelLayer({ els, isolated, selected, onSelect, onHover }: Props) {
  const root = useRef<HTMLDivElement>(null);
  useLabelDeclutter(els, root, selected);
  return (
    <div className="scene-labels" ref={root}>
      {Object.keys(LABEL_AT).map((key) => {
        const id = key.split(':')[0] as PartId;
        if (isolated && isolated !== id) return null;
        return (
          <button
            key={key}
            type="button"
            ref={(el) => {
              if (el) els.set(key, el);
              else els.delete(key);
            }}
            className={`scene-label${selected === id ? ' sel' : ''}`}
            onClick={() => onSelect(id)}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(id)}
            onBlur={() => onHover(null)}
          >
            {LABEL_TEXT[key]}
          </button>
        );
      })}
    </div>
  );
}
