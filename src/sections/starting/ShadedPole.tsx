import { useMemo, useRef } from 'react';
import { LineChart, type Series } from '../../components/LineChart';
import type { PartKey } from '../../content/startingMethods';
import { Part, PartCard } from './Part';
import { useClock } from '../../hooks/useClock';

/** Illustrative values: the shaded flux is weaker than, and lags, the unshaded flux. */
const LAG_DEG = 50;
const SHADED_SCALE = 0.65;
const FLUX_BLUE = '#7db0ff';
const FLUX_PINK = '#f080aa';
const COPPER = '#d98b4d';

const unshadedAt = (rad: number) => Math.sin(rad);
const shadedAt = (rad: number) => SHADED_SCALE * Math.sin(rad - (LAG_DEG * Math.PI) / 180);

function FluxArrow({ x, y0, len, dashed, color }: { x: number; y0: number; len: number; dashed?: boolean; color: string }) {
  if (Math.abs(len) < 5) return <circle cx={x} cy={y0} r={3} fill={color} />;
  const s = Math.sign(len);
  const y1 = y0 + len;
  return (
    <g stroke={color} strokeWidth={4} strokeDasharray={dashed ? '7 4' : undefined} fill={color}>
      <line x1={x} y1={y0} x2={x} y2={y1 - s * 6} />
      <path d={`M${x},${y1}L${x - 7},${y1 - s * 11}L${x + 7},${y1 - s * 11}Z`} strokeWidth={1} />
    </g>
  );
}

interface Props {
  selected: PartKey | null;
  onSelect: (k: PartKey | null) => void;
}

// geometry of the drawing [diagram units]
const GAP_Y = 160; // bottom of the pole face
const AMP = 44; // flux arrow length at the peak

/** One pole of a shaded-pole motor: the coil, the pole face with its shading ring, and the two fluxes that make the field sweep. */
export default function ShadedPole({ selected, onSelect }: Props) {
  const ref = useRef<SVGSVGElement>(null);
  const phase = useClock(ref, 0.5);

  const series = useMemo<Series[]>(() => {
    const pts = (f: (r: number) => number) => Array.from({ length: 181 }, (_, i) => [i * 2, f((i * 2 * Math.PI) / 180)] as const);
    return [
      { id: 'u', label: 'Unshaded part', color: FLUX_BLUE, width: 2.6, points: pts(unshadedAt) },
      { id: 's', label: 'Shaded part (weaker, lags)', color: FLUX_PINK, width: 2.6, dash: '9 5', points: pts(shadedAt) },
    ];
  }, []);

  return (
    <div className="shaded">
      <svg ref={ref} className="circuit-svg" viewBox="0 0 680 340" role="group" aria-label="One pole of a shaded-pole motor. Select a part for details.">
        <defs>
          <pattern id="sp-lam" width="7" height="7" patternUnits="userSpaceOnUse">
            <path d="M0,7L7,0" stroke="#7b8aa0" strokeWidth="1" />
          </pattern>
        </defs>

        {/* laminated stator iron: yoke, pole body, and the pole face split by a slot */}
        <g className="iron">
          <rect x={140} y={24} width={400} height={32} />
          <rect x={290} y={56} width={100} height={68} />
          <rect x={190} y={124} width={208} height={36} />
          <rect x={404} y={124} width={86} height={36} />
        </g>

        <Part id="coil" label="Coil" sub="the only winding" box={{ x: 150, y: 56, w: 256, h: 68 }} labelAt={{ x: 272, y: 84, anchor: 'end' }} selected={selected} onSelect={onSelect}>
          <g stroke={COPPER} strokeWidth={6} strokeLinecap="round" fill="none">
            {[64, 76, 88, 100, 112].map((y) => (
              <line key={y} x1={282} y1={y} x2={398} y2={y} />
            ))}
          </g>
        </Part>

        <Part id="unshaded" label="Unshaded part" sub="flux follows the coil" box={{ x: 40, y: 118, w: 360, h: 48 }} labelAt={{ x: 182, y: 138, anchor: 'end' }} selected={selected} onSelect={onSelect}>
          <rect x={190} y={124} width={208} height={36} fill="none" />
        </Part>

        <Part id="ring" label="Shading ring" sub="shorted copper loop" box={{ x: 394, y: 112, w: 270, h: 60 }} labelAt={{ x: 512, y: 138 }} selected={selected} onSelect={onSelect}>
          <rect x={397} y={118} width={96} height={48} rx={8} fill="none" stroke={COPPER} strokeWidth={6} />
        </Part>

        {/* air gap and rotor */}
        <rect x={160} y={GAP_Y} width={360} height={18} className="gap" />
        <Part id="rotor" label="Squirrel-cage rotor" sub="follows the sweep" box={{ x: 150, y: 178, w: 514, h: 66 }} labelAt={{ x: 534, y: 206 }} selected={selected} onSelect={onSelect}>
          <rect x={160} y={178} width={360} height={60} className="rotor" />
          {Array.from({ length: 12 }, (_, i) => (
            <circle key={i} cx={178 + i * 30.5} cy={192} r={5} fill={COPPER} />
          ))}
        </Part>

        <FluxArrow x={290} y0={GAP_Y} len={AMP * unshadedAt(phase)} color={FLUX_BLUE} />
        <FluxArrow x={447} y0={GAP_Y} len={AMP * shadedAt(phase)} dashed color={FLUX_PINK} />

        <g className="sweep" aria-hidden="true">
          <path d="M250,266H430" />
          <path d="M430,266l-10,-6v12z" />
          <text x={340} y={292} textAnchor="middle">
            Field sweeps toward the shaded part; the rotor follows
          </text>
        </g>
        <g className="legend" aria-hidden="true">
          <line x1={14} y1={322} x2={44} y2={322} stroke={FLUX_BLUE} strokeWidth={4} />
          <text x={52} y={326}>
            Flux, unshaded part
          </text>
          <line x1={200} y1={322} x2={230} y2={322} stroke={FLUX_PINK} strokeWidth={4} strokeDasharray="7 4" />
          <text x={238} y={326}>
            Flux, shaded part (weaker, lags by {LAG_DEG}° here)
          </text>
        </g>
      </svg>
      <PartCard part={selected} onClose={() => onSelect(null)} />
      <LineChart
        title="Flux in the two parts of the pole"
        desc="The flux in the shaded part is weaker than in the unshaded part and peaks later, which makes the field sweep from the unshaded part toward the shaded part."
        series={series}
        xLabel="Time (degrees of one cycle)"
        yLabel="Flux (relative)"
        xDomain={[0, 360]}
        yDomain={[-1.2, 1.2]}
        height={230}
        cursorX={((phase * 180) / Math.PI) % 360}
      />
      <p className="muted small">
        The {LAG_DEG}° lag and the 0.65 flux ratio are illustrative round numbers, not measurements. Real motors have a lag of a few tens of degrees that depends on the ring and the slot.
      </p>
    </div>
  );
}
