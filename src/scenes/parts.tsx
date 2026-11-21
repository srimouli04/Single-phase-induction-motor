// Procedural geometry for the representative capacitor-start motor. The shaft axis is +x (drive end at +x).
// Dimensions are model units (housing radius ~1); the model is deliberately not to scale (exaggerated air gap).
import { createContext, useContext, useEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useCursor } from '@react-three/drei';
import { LABEL_AT, explodeOffset, type PartId, type Vec3 } from './layout';

export interface SceneState {
  explode: number;
  selected: PartId | null;
  hovered: PartId | null;
  isolated: PartId | null;
  /** "Show in context": every other part is drawn as a faint ghost so this one stands out in the assembly. */
  context: PartId | null;
  showLabels: boolean;
  housingTransparent: boolean;
  onSelect: (id: PartId | null) => void;
  onHover: (id: PartId | null) => void;
  /** DOM label buttons by part key; the scene writes their screen position every frame (see LabelProbe). */
  labelEls: Map<string, HTMLElement>;
  angle: MutableRefObject<number>;
}
export const SceneCtx = createContext<SceneState | null>(null);
const useScene = (): SceneState => {
  const v = useContext(SceneCtx);
  if (!v) throw new Error('Scene context missing');
  return v;
};

interface PartInfo {
  selected: boolean;
  hovered: boolean;
  ghost: boolean;
}
const PartCtx = createContext<PartInfo>({ selected: false, hovered: false, ghost: false });

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- helpers

function useGeo<T extends THREE.BufferGeometry>(factory: () => T): T {
  const g = useMemo(factory, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

/** Annulus extruded along the x axis (centred on x = 0). */
function ringGeo(outer: number, inner: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, TAU, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 48 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** Stator lamination: outer circle, bore with 24 open slots. */
function statorPlateGeo(depth: number): THREE.ExtrudeGeometry {
  const N = 24;
  const pitch = TAU / N;
  const w = pitch * 0.26; // slot half-width (angle)
  const ri = 0.55;
  const rs = 0.72;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, 0.9, 0, TAU, false);
  const pts: THREE.Vector2[] = [];
  const at = (r: number, a: number) => pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)));
  for (let i = 0; i < N; i++) {
    const c1 = (i + 1) * pitch;
    const a0 = i * pitch + w;
    const a1 = c1 - w;
    for (let k = 0; k <= 3; k++) at(ri, a0 + ((a1 - a0) * k) / 3);
    at(rs, c1 - w);
    at(rs, c1);
    at(rs, c1 + w);
  }
  const hole = new THREE.Path();
  hole.setFromPoints(pts);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

/** One coil (racetrack loop) lying in two slots at angles thetaA, thetaB (rad, from +y towards +z). */
function coilGeo(thetaA: number, thetaB: number, rSlot: number, halfLen: number, bulge: number, tube: number, lift: number): THREE.TubeGeometry {
  const P = (x: number, th: number, r: number) => new THREE.Vector3(x, r * Math.cos(th), r * Math.sin(th));
  const mid = (thetaA + thetaB) / 2;
  const pts: THREE.Vector3[] = [];
  const side = (th: number, from: number, to: number) => {
    for (let k = 0; k <= 3; k++) pts.push(P(from + ((to - from) * k) / 3, th, rSlot));
  };
  side(thetaA, -halfLen, halfLen);
  pts.push(P(halfLen + bulge * 0.55, (thetaA + mid) / 2, rSlot + lift * 0.6));
  pts.push(P(halfLen + bulge, mid, rSlot + lift));
  pts.push(P(halfLen + bulge * 0.55, (thetaB + mid) / 2, rSlot + lift * 0.6));
  side(thetaB, halfLen, -halfLen);
  pts.push(P(-halfLen - bulge * 0.55, (thetaB + mid) / 2, rSlot + lift * 0.6));
  pts.push(P(-halfLen - bulge, mid, rSlot + lift));
  pts.push(P(-halfLen - bulge * 0.55, (thetaA + mid) / 2, rSlot + lift * 0.6));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true, 'centripetal'), 96, tube, 8, true);
}

// ---------------------------------------------------------------- materials, part wrapper

interface MatProps {
  color: string;
  metalness?: number;
  roughness?: number;
  opacity?: number;
  double?: boolean;
}
function Mat({ color, metalness = 0.35, roughness = 0.55, opacity = 1, double }: MatProps) {
  const p = useContext(PartCtx);
  const glow = p.selected ? 0.65 : p.hovered ? 0.3 : 0;
  const clear = p.ghost || opacity < 1;
  return (
    // key: three.js compiles a different shader for opaque and transparent materials, so toggling needs a new material.
    <meshStandardMaterial
      key={clear ? 'clear' : 'solid'}
      color={color}
      metalness={metalness}
      roughness={roughness}
      emissive={p.selected ? '#ffb300' : '#4fa8ff'}
      emissiveIntensity={glow}
      transparent={clear}
      opacity={p.ghost ? Math.min(opacity, 0.15) : opacity}
      depthWrite={!clear}
      side={double ? THREE.DoubleSide : THREE.FrontSide}
    />
  );
}

/**
 * Moves a DOM label to the screen position of a 3D anchor. Labels live in the page (not inside the canvas) so they stay
 * real, focusable buttons without nesting a second React root in the scene.
 */
function LabelProbe({ k, at }: { k: string; at: Vec3 }) {
  const anchor = useRef<THREE.Object3D>(null);
  const { labelEls } = useScene();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    const el = labelEls.get(k);
    if (!el || !anchor.current) return;
    anchor.current.getWorldPosition(v).project(camera);
    const x = ((v.x + 1) / 2) * size.width;
    const y = ((1 - v.y) / 2) * size.height;
    const inFront = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.15;
    el.style.visibility = inFront ? 'visible' : 'hidden';
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    // Raw anchor for LabelLayer, which nudges overlapping labels apart (via the separate CSS `translate` property).
    el.dataset.x = String(x);
    el.dataset.y = String(y);
  });
  return <object3D ref={anchor} position={at} />;
}

function Part({ id, slot, children }: { id: PartId; slot?: 'de' | 'nde'; children: ReactNode }) {
  const s = useScene();
  const key = slot ? `${id}:${slot}` : id;
  useCursor(s.hovered === id);
  if (s.isolated && s.isolated !== id) return null;
  const [dx, dy, dz] = explodeOffset(key, s.explode);
  const selected = s.selected === id;
  const housingGhost = id === 'housing' && s.housingTransparent;
  const info: PartInfo = { selected, hovered: s.hovered === id, ghost: housingGhost || (s.context !== null && s.context !== id) };
  // A see-through housing must not swallow clicks meant for the parts inside it, so it gets no handlers.
  const handlers = housingGhost
    ? {}
    : {
        onPointerOver: (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          s.onHover(id);
        },
        onPointerOut: () => s.onHover(null),
        onClick: (e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          s.onSelect(id);
        },
      };
  return (
    <group position={[dx, dy, dz]} name={key} {...handlers}>
      <PartCtx.Provider value={info}>{children}</PartCtx.Provider>
      {s.showLabels && <LabelProbe k={key} at={LABEL_AT[key] ?? [0, 0, 0]} />}
    </group>
  );
}

/** Rotates its children about the shaft axis with the shared rotor angle. */
function Spin({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const { angle } = useScene();
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = angle.current;
  });
  return <group ref={ref}>{children}</group>;
}

// ---------------------------------------------------------------- the parts

function Housing() {
  const shell = useGeo(() => ringGeo(1.05, 0.93, 1.9));
  const fin = useGeo(() => new THREE.BoxGeometry(1.7, 0.1, 0.035));
  return (
    <Part id="housing">
      <mesh geometry={shell}>
        <Mat color="#5f7083" metalness={0.55} roughness={0.5} />
      </mesh>
      {range(36).map((i) => (
        <group key={i} rotation={[(i / 36) * TAU, 0, 0]}>
          <mesh geometry={fin} position={[0, 1.08, 0]}>
            <Mat color="#56677a" metalness={0.55} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {[-0.62, 0.62].map((z) => (
        <mesh key={z} position={[0, -1.08, z]}>
          <boxGeometry args={[1.35, 0.14, 0.34]} />
          <Mat color="#4c5c6e" metalness={0.5} roughness={0.55} />
        </mesh>
      ))}
      <mesh position={[0.45, 1.095, 0]}>
        <boxGeometry args={[0.72, 0.04, 0.64]} />
        <Mat color="#4c5c6e" metalness={0.5} roughness={0.55} />
      </mesh>
    </Part>
  );
}

function Stator() {
  const plate = useGeo(() => statorPlateGeo(0.105));
  return (
    <Part id="stator">
      {range(12).map((i) => (
        <mesh key={i} geometry={plate} position={[-0.75 + 0.125 * (i + 0.5), 0, 0]}>
          <Mat color="#8b99aa" metalness={0.7} roughness={0.38} />
        </mesh>
      ))}
    </Part>
  );
}

function Windings() {
  const d = (deg: number) => (deg * Math.PI) / 180;
  const main = useMemo(
    () => range(4).flatMap((k) => range(3).map((t) => coilGeo(d(k * 90 - 45), d(k * 90 + 45), 0.62 + t * 0.028, 0.78 + t * 0.012, 0.12 + t * 0.02, 0.022, 0.05 + t * 0.012))),
    [],
  );
  const aux = useMemo(
    () => range(4).flatMap((k) => range(2).map((t) => coilGeo(d(k * 90 + 30), d(k * 90 + 60), 0.62 + t * 0.03, 0.8 + t * 0.012, 0.16 + t * 0.02, 0.022, 0.13 + t * 0.012))),
    [],
  );
  useEffect(() => () => [...main, ...aux].forEach((g) => g.dispose()), [main, aux]);
  return (
    <>
      <Part id="mainWinding">
        {main.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Mat color="#e0872a" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
      </Part>
      <Part id="auxWinding">
        {aux.map((g, i) => (
          <mesh key={i} geometry={g}>
            <Mat color="#38b6e0" metalness={0.5} roughness={0.35} />
          </mesh>
        ))}
      </Part>
    </>
  );
}

function AirGap() {
  const ring = useGeo(() => ringGeo(0.548, 0.502, 1.5));
  return (
    <Part id="airGap">
      <mesh geometry={ring}>
        <Mat color="#3de0ff" opacity={0.4} metalness={0} roughness={1} />
      </mesh>
    </Part>
  );
}

function Rotor() {
  const disc = useGeo(() => {
    const g = new THREE.CylinderGeometry(0.5, 0.5, 0.098, 40);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const bar = useGeo(() => new THREE.BoxGeometry(1.62, 0.05, 0.05));
  const ring = useGeo(() => {
    const g = new THREE.TorusGeometry(0.48, 0.04, 12, 40);
    g.rotateY(Math.PI / 2);
    return g;
  });
  return (
    <Part id="rotor">
      <Spin>
        {range(14).map((i) => (
          <mesh key={i} geometry={disc} position={[-0.75 + (1.5 / 14) * (i + 0.5), 0, 0]}>
            <Mat color="#6c7a8d" metalness={0.65} roughness={0.4} />
          </mesh>
        ))}
        {range(20).map((i) => (
          <group key={i} rotation={[(i / 20) * TAU, 0, 0]}>
            <mesh geometry={bar} position={[0, 0.495, 0]}>
              <Mat color="#dfe5ec" metalness={0.8} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} geometry={ring} position={[x, 0, 0]}>
            <Mat color="#dfe5ec" metalness={0.8} roughness={0.28} />
          </mesh>
        ))}
      </Spin>
    </Part>
  );
}

function Shaft() {
  const body = useGeo(() => {
    const g = new THREE.CylinderGeometry(0.12, 0.12, 4.3, 28);
    g.rotateZ(Math.PI / 2);
    g.translate(0.275, 0, 0);
    return g;
  });
  return (
    <Part id="shaft">
      <Spin>
        <mesh geometry={body}>
          <Mat color="#b3bcc8" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position={[2.1, 0.115, 0]}>
          <boxGeometry args={[0.5, 0.03, 0.07]} />
          <Mat color="#323a44" />
        </mesh>
      </Spin>
    </Part>
  );
}

function Bearing({ side }: { side: 'de' | 'nde' }) {
  const x = side === 'de' ? 1.12 : -1.12;
  const outer = useGeo(() => ringGeo(0.27, 0.235, 0.16));
  const inner = useGeo(() => ringGeo(0.17, 0.12, 0.16));
  const ball = useGeo(() => new THREE.SphereGeometry(0.033, 12, 10));
  return (
    <Part id="bearings" slot={side}>
      <group position={[x, 0, 0]}>
        <mesh geometry={outer}>
          <Mat color="#cbd2db" metalness={0.9} roughness={0.25} />
        </mesh>
        <Spin>
          <mesh geometry={inner}>
            <Mat color="#b7c0cb" metalness={0.9} roughness={0.25} />
          </mesh>
          {range(9).map((i) => (
            <mesh key={i} geometry={ball} position={[0, 0.2025 * Math.cos((i / 9) * TAU), 0.2025 * Math.sin((i / 9) * TAU)]}>
              <Mat color="#eef2f6" metalness={1} roughness={0.15} />
            </mesh>
          ))}
        </Spin>
      </group>
    </Part>
  );
}

function EndShield({ side }: { side: 'de' | 'nde' }) {
  const s = side === 'de' ? 1 : -1;
  const plate = useGeo(() => ringGeo(1.0, 0.27, 0.2));
  const hub = useGeo(() => ringGeo(0.4, 0.27, 0.2));
  return (
    <Part id="endShields" slot={side}>
      <mesh geometry={plate} position={[s * 1.05, 0, 0]}>
        <Mat color="#4f6075" metalness={0.5} roughness={0.5} />
      </mesh>
      <mesh geometry={hub} position={[s * 1.25, 0, 0]}>
        <Mat color="#4f6075" metalness={0.5} roughness={0.5} />
      </mesh>
      {range(4).map((i) => (
        <group key={i} rotation={[(i * Math.PI) / 2 + Math.PI / 4, 0, 0]}>
          <mesh position={[s * 1.2, 0.68, 0]}>
            <boxGeometry args={[0.07, 0.56, 0.06]} />
            <Mat color="#4f6075" metalness={0.5} roughness={0.5} />
          </mesh>
        </group>
      ))}
      {range(4).map((i) => (
        <group key={i} rotation={[(i * Math.PI) / 2, 0, 0]}>
          <mesh position={[s * 1.18, 0.9, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.045, 0.045, 0.07, 12]} />
            <Mat color="#2b333d" metalness={0.8} roughness={0.35} />
          </mesh>
        </group>
      ))}
    </Part>
  );
}

function Fan() {
  return (
    <Part id="fan">
      <Spin>
        <group position={[-1.55, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.17, 0.17, 0.16, 24]} />
            <Mat color="#8c99a8" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh rotation={[0, 0, Math.PI / 2]} position={[0.05, 0, 0]}>
            <cylinderGeometry args={[0.58, 0.58, 0.025, 40]} />
            <Mat color="#3e5470" metalness={0.4} roughness={0.5} />
          </mesh>
          {range(10).map((i) => (
            <group key={i} rotation={[(i / 10) * TAU, 0, 0]}>
              <mesh position={[-0.03, 0.4, 0]} rotation={[0, 0.6, 0]}>
                <boxGeometry args={[0.04, 0.34, 0.2]} />
                <Mat color="#4d9bd8" metalness={0.3} roughness={0.5} />
              </mesh>
            </group>
          ))}
        </group>
      </Spin>
    </Part>
  );
}

function FanCover() {
  const skirt = useGeo(() => {
    const g = new THREE.CylinderGeometry(1.0, 1.0, 0.85, 48, 1, true);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const hoop = useGeo(() => {
    const g = new THREE.TorusGeometry(1, 0.014, 6, 56);
    g.rotateY(Math.PI / 2);
    return g;
  });
  return (
    <Part id="fanCover">
      <mesh geometry={skirt} position={[-1.575, 0, 0]}>
        <Mat color="#3a4859" metalness={0.5} roughness={0.55} double />
      </mesh>
      {[0.28, 0.52, 0.76, 0.99].map((r) => (
        <mesh key={r} geometry={hoop} position={[-2.0, 0, 0]} scale={[1, r, r]}>
          <Mat color="#6a7b8f" metalness={0.7} roughness={0.4} />
        </mesh>
      ))}
      {range(16).map((i) => (
        <group key={i} rotation={[(i / 16) * TAU, 0, 0]}>
          <mesh position={[-2.0, 0.5, 0]}>
            <boxGeometry args={[0.022, 1.0, 0.026]} />
            <Mat color="#6a7b8f" metalness={0.7} roughness={0.4} />
          </mesh>
        </group>
      ))}
    </Part>
  );
}

function TerminalBox() {
  const { explode } = useScene();
  const lift = 0.55 * Math.min(1.5, Math.max(0, (explode - 0.45) / 0.55));
  return (
    <Part id="terminalBox">
      <mesh position={[0.45, 1.2, 0]}>
        <boxGeometry args={[0.55, 0.28, 0.5]} />
        <Mat color="#44566b" metalness={0.45} roughness={0.55} />
      </mesh>
      <mesh position={[0.45, 1.37 + lift, 0]}>
        <boxGeometry args={[0.6, 0.05, 0.55]} />
        <Mat color="#566a82" metalness={0.45} roughness={0.5} />
      </mesh>
      {[-0.14, 0, 0.14].map((z) => (
        <mesh key={z} position={[0.45, 1.36, z]}>
          <cylinderGeometry args={[0.03, 0.03, 0.12, 12]} />
          <Mat color="#d8a53c" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </Part>
  );
}

function Capacitor() {
  const can = useGeo(() => {
    const g = new THREE.CylinderGeometry(0.2, 0.2, 0.8, 28);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const band = useGeo(() => {
    const g = new THREE.CylinderGeometry(0.204, 0.204, 0.22, 28);
    g.rotateZ(Math.PI / 2);
    return g;
  });
  const strap = useGeo(() => {
    const g = new THREE.TorusGeometry(0.205, 0.014, 8, 28);
    g.rotateY(Math.PI / 2);
    return g;
  });
  return (
    <Part id="capacitor">
      <group position={[-0.35, 1.27, 0]}>
        <mesh geometry={can}>
          <Mat color="#1d3f73" metalness={0.45} roughness={0.5} />
        </mesh>
        <mesh geometry={band} position={[-0.05, 0, 0]}>
          <Mat color="#e9eef5" metalness={0.1} roughness={0.8} />
        </mesh>
        {[-0.26, 0.26].map((x) => (
          <mesh key={x} geometry={strap} position={[x, 0, 0]}>
            <Mat color="#9aa6b4" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {[-0.07, 0.07].map((z) => (
          <mesh key={z} position={[0.43, 0.04, z]}>
            <boxGeometry args={[0.07, 0.05, 0.035]} />
            <Mat color="#d8a53c" metalness={0.9} roughness={0.25} />
          </mesh>
        ))}
      </group>
    </Part>
  );
}

function CentrifugalSwitch() {
  return (
    <Part id="centrifugalSwitch">
      <Spin>
        <group position={[-0.88, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.19, 0.19, 0.1, 28]} />
            <Mat color="#c9a227" metalness={0.85} roughness={0.3} />
          </mesh>
          {[0, Math.PI].map((a) => (
            <group key={a} rotation={[a, 0, 0]}>
              <mesh position={[0, 0.235, 0]}>
                <boxGeometry args={[0.04, 0.1, 0.05]} />
                <Mat color="#c9a227" metalness={0.85} roughness={0.3} />
              </mesh>
              <mesh position={[0.02, 0.31, 0]}>
                <boxGeometry args={[0.07, 0.07, 0.13]} />
                <Mat color="#d6d9de" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
          ))}
        </group>
      </Spin>
      <mesh position={[-0.925, 0.42, 0]}>
        <boxGeometry args={[0.03, 0.36, 0.26]} />
        <Mat color="#5b3a22" metalness={0.1} roughness={0.8} />
      </mesh>
      {[-0.07, 0.07].map((z) => (
        <mesh key={z} position={[-0.885, 0.32, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.06, 12]} />
          <Mat color="#e8ecf1" metalness={0.95} roughness={0.2} />
        </mesh>
      ))}
    </Part>
  );
}

/** Complete motor: all fourteen selectable components. */
export function Motor() {
  return (
    <group>
      <Housing />
      <Stator />
      <Windings />
      <AirGap />
      <Rotor />
      <Shaft />
      <Bearing side="de" />
      <Bearing side="nde" />
      <EndShield side="de" />
      <EndShield side="nde" />
      <Fan />
      <FanCover />
      <TerminalBox />
      <Capacitor />
      <CentrifugalSwitch />
    </group>
  );
}
