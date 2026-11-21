// The R3F canvas: lights, local (procedural) reflections, orbit camera with an imperative API, shared rotor angle.
import { useEffect, useRef, useState, type ComponentRef, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Motor, SceneCtx, type SceneState } from './parts';
import { FOCUS, fitDistance, framingTarget, type PartId } from './layout';

export type ViewName = 'iso' | 'side' | 'end' | 'top';

/** Camera commands for the toolbar and keyboard handlers. */
export interface SceneApi {
  view: (name: ViewName, explode: number) => void;
  /** Re-frame the whole motor for this explosion amount, keeping the current viewing direction. */
  fit: (explode: number) => void;
  rotate: (azimuthDeg: number, polarDeg: number) => void;
  zoom: (factor: number) => void;
  focus: (id: PartId) => void;
}

const DIRECTION: Record<ViewName, THREE.Vector3> = {
  iso: new THREE.Vector3(0.3, 0.42, 1).normalize(),
  side: new THREE.Vector3(0, 0.06, 1).normalize(),
  end: new THREE.Vector3(1, 0.1, 0.02).normalize(),
  top: new THREE.Vector3(0.02, 1, 0.1).normalize(),
};
const DEG = Math.PI / 180;
const MIN_DIST = 2.4;
const MAX_DIST = 30;
const framing = (explode: number): THREE.Vector3 => new THREE.Vector3(...framingTarget(explode));

/** Reflections without any download: three's built-in RoomEnvironment rendered into a PMREM cube map. */
function LocalEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      room.dispose();
    };
  }, [gl, scene]);
  return null;
}

interface RigProps {
  apiRef: MutableRefObject<SceneApi | null>;
  motionOn: boolean;
  /** Explosion amount of the first frame; also the one re-framed on resize until the user moves the camera. */
  explodeRef: MutableRefObject<number>;
}

/** Orbit controls plus fly-to animation; publishes the camera API through `apiRef`. */
function Rig({ apiRef, motionOn, explodeRef }: RigProps) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const { camera, invalidate, size } = useThree();
  const flight = useRef<{ t: number; p0: THREE.Vector3; p1: THREE.Vector3; a0: THREE.Vector3; a1: THREE.Vector3 } | null>(null);
  const motion = useRef(motionOn);
  motion.current = motionOn;
  const aspect = useRef(1.5);
  aspect.current = size.width / Math.max(1, size.height);
  const userMoved = useRef(false);

  useEffect(() => {
    const flyTo = (pos: THREE.Vector3, target: THREE.Vector3, instant = false) => {
      const c = controls.current;
      if (!c) return;
      if (instant || !motion.current) {
        flight.current = null;
        camera.position.copy(pos);
        c.target.copy(target);
        c.update();
        invalidate();
        return;
      }
      flight.current = { t: 0, p0: camera.position.clone(), p1: pos, a0: c.target.clone(), a1: target };
      invalidate();
    };
    const frame = (dir: THREE.Vector3, explode: number, instant = false) => {
      const target = framing(explode);
      explodeRef.current = explode;
      userMoved.current = false;
      flyTo(target.clone().addScaledVector(dir, fitDistance(explode, aspect.current)), target, instant);
    };
    const currentDir = () => {
      const c = controls.current;
      return c ? camera.position.clone().sub(c.target).normalize() : DIRECTION.iso.clone();
    };

    apiRef.current = {
      view: (name, explode) => frame(DIRECTION[name], explode),
      fit: (explode) => frame(currentDir(), explode),
      focus: (id) => {
        const f = FOCUS[id];
        const dir = currentDir();
        dir.y = Math.min(Math.max(dir.y, 0.15), 0.7); // keep a readable elevation
        if (dir.z < 0.2) dir.z = 0.5; // never look from behind the label side
        userMoved.current = true;
        // f.dist is tuned for a roughly 1.5:1 canvas; scale it so narrow canvases still show the surroundings.
        const dist = f.dist * Math.max(1, 1.5 / Math.max(aspect.current, 0.3)) ** 0.7;
        flyTo(new THREE.Vector3(...f.at).addScaledVector(dir.normalize(), dist), new THREE.Vector3(...f.at));
      },
      rotate: (az, pol) => {
        const c = controls.current;
        if (!c) return;
        const offset = camera.position.clone().sub(c.target);
        const sph = new THREE.Spherical().setFromVector3(offset);
        sph.theta += az * DEG;
        sph.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sph.phi + pol * DEG));
        offset.setFromSpherical(sph);
        flight.current = null;
        userMoved.current = true;
        camera.position.copy(c.target).add(offset);
        c.update();
        invalidate();
      },
      zoom: (factor) => {
        const c = controls.current;
        if (!c) return;
        const offset = camera.position.clone().sub(c.target).multiplyScalar(factor);
        offset.setLength(Math.min(MAX_DIST, Math.max(MIN_DIST, offset.length())));
        flight.current = null;
        userMoved.current = true;
        camera.position.copy(c.target).add(offset);
        c.update();
        invalidate();
      },
    };
    frame(DIRECTION.iso, explodeRef.current, true); // first frame, sized to the real canvas
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, invalidate, explodeRef]);

  // Canvas resized (window, rotation, layout change): re-frame unless the user has taken the camera.
  useEffect(() => {
    if (!userMoved.current) apiRef.current?.fit(explodeRef.current);
  }, [size.width, size.height, apiRef, explodeRef]);

  useFrame((_, dt) => {
    const f = flight.current;
    const c = controls.current;
    if (!f || !c) return;
    f.t = Math.min(1, f.t + Math.min(dt, 0.05) / 0.7);
    const k = f.t < 0.5 ? 4 * f.t ** 3 : 1 - (-2 * f.t + 2) ** 3 / 2; // ease in-out cubic
    camera.position.lerpVectors(f.p0, f.p1, k);
    c.target.lerpVectors(f.a0, f.a1, k);
    c.update();
    if (f.t >= 1) flight.current = null;
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={motionOn}
      dampingFactor={0.12}
      minDistance={MIN_DIST}
      maxDistance={MAX_DIST}
      rotateSpeed={0.75}
      zoomSpeed={0.8}
      screenSpacePanning
      onStart={() => {
        userMoved.current = true;
        flight.current = null;
      }}
    />
  );
}

/** Advances the shared rotor angle (illustrative speed, not a real rpm). */
function Spinner({ angle, spin, speed }: { angle: MutableRefObject<number>; spin: boolean; speed: number }) {
  useFrame((_, dt) => {
    if (spin) angle.current = (angle.current + Math.min(dt, 0.05) * speed) % (Math.PI * 2);
  });
  return null;
}

export interface MotorSceneProps {
  state: Omit<SceneState, 'angle'>;
  spin: boolean;
  /** Visual rotation speed in rad/s. */
  spinSpeed: number;
  motionOn: boolean;
  apiRef: MutableRefObject<SceneApi | null>;
  onContextLost: () => void;
  initialExplode: number;
}

export default function MotorScene({ state, spin, spinSpeed, motionOn, apiRef, onContextLost, initialExplode }: MotorSceneProps) {
  const angle = useRef(0);
  const explodeRef = useRef(initialExplode);
  // Unmounting the canvas also "loses" its context; only a loss while we are on screen is a real problem.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const animating = spin && motionOn;
  // Rough starting pose; the Rig re-frames to the real canvas size on its first effect.
  const [startPosition] = useState(() => {
    const t = framing(initialExplode);
    return t.clone().addScaledVector(DIRECTION.iso, fitDistance(initialExplode)).toArray() as [number, number, number];
  });

  return (
    <Canvas
      className="scene-canvas"
      frameloop={animating ? 'always' : 'demand'}
      dpr={[1, 2]}
      camera={{ fov: 38, near: 0.1, far: 120, position: startPosition }}
      gl={{ antialias: true, powerPreference: 'default' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', (e) => {
          e.preventDefault();
          if (alive.current) onContextLost();
        });
      }}
      onPointerMissed={() => state.onSelect(null)}
    >
      <LocalEnvironment />
      <hemisphereLight args={['#dbe8ff', '#1a2230', 0.55]} />
      <directionalLight position={[5, 8, 6]} intensity={1.5} />
      <directionalLight position={[-6, 3, -5]} intensity={0.55} color="#9cc4ff" />
      <Rig apiRef={apiRef} motionOn={motionOn} explodeRef={explodeRef} />
      <Spinner angle={angle} spin={spin} speed={spinSpeed} />
      {/* R3F runs in its own React root: context from the page does not cross the Canvas, so it is provided here. */}
      <SceneCtx.Provider value={{ ...state, angle }}>
        <Motor />
      </SceneCtx.Provider>
    </Canvas>
  );
}
