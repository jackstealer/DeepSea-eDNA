import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { BASE_COLORS, COMPLEMENT, UNKNOWN_BASE_COLOR, damp, useWindowPointer, type PointerRef } from './shared';
import { TAXON_COLORS } from './palette';
import { sceneMotion } from './Scene3DGate';

/** One pose of the helix. The landing page blends between poses as the visitor scrolls. */
export interface HelixPose {
  x: number;
  y: number;
  z: number;
  /** rotation in the screen plane, radians (0 = upright) */
  tilt: number;
  scale: number;
  /** 0 = twisted double helix, 1 = flat ladder */
  unwind: number;
  /** 0 = iridescent glass, 1 = nucleotide colours */
  tint: number;
  /** 0 = intact, 1 = base pairs gathered into one cluster per taxon */
  sort: number;
}

const POSE_KEYS = ['x', 'y', 'z', 'tilt', 'scale', 'unwind', 'tint', 'sort'] as const;

const PAIRS = 96;
const RISE = 0.13;
const TWIST = 0.22;
/** length of one half-rung (one nucleotide) */
const HALF = 0.6;
const CLUSTER_RADIUS = 2.1;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const helixPos = new THREE.Vector3();
const sortPos = new THREE.Vector3();
const offset = new THREE.Vector3();
const helixQuat = new THREE.Quaternion();

function seeded(n: number): number {
  const s = Math.sin(n * 91.173 + 7.31) * 43758.5453;
  return s - Math.floor(s);
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);

interface Pair {
  letters: [string, string];
  /** one colour per half, so each rung shows a two-tone sheen */
  glass: [THREE.Color, THREE.Color];
  jitter: THREE.Vector3;
  tumble: THREE.Quaternion;
  group: number;
}

function buildPairs(bases: string): Pair[] {
  return Array.from({ length: PAIRS }, (_, i) => {
    const base = (bases[i % Math.max(bases.length, 1)] ?? 'N').toUpperCase();
    // Cyan -> violet -> pink and back, twice along the strand, like thin-film glass
    const hue = 0.5 + 0.34 * (0.5 - 0.5 * Math.cos((i / (PAIRS - 1)) * Math.PI * 4));
    return {
      letters: [base, COMPLEMENT[base] ?? 'N'],
      glass: [new THREE.Color().setHSL(hue, 0.85, 0.66), new THREE.Color().setHSL(hue + 0.1, 0.85, 0.7)],
      jitter: new THREE.Vector3(seeded(i) - 0.5, seeded(i + 100) - 0.5, seeded(i + 200) - 0.5).multiplyScalar(0.9),
      tumble: new THREE.Quaternion().setFromEuler(
        new THREE.Euler(seeded(i + 300) * 6.28, seeded(i + 400) * 6.28, seeded(i + 500) * 6.28)
      ),
      group: i % TAXON_COLORS.length,
    };
  });
}

function Strand({
  stage,
  poses,
  bases,
  animate,
  speed,
  pointer,
}: {
  stage: MutableRefObject<number>;
  poses: HelixPose[];
  bases: string;
  animate: boolean;
  /** ambient spin speed: 1 full motion, 1/3 under reduced motion, 0 paused */
  speed: number;
  pointer: PointerRef;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const group = useRef<THREE.Group>(null);
  const pairs = useMemo(() => buildPairs(bases), [bases]);
  const geometry = useMemo(() => new RoundedBoxGeometry(HALF, 0.07, 0.34, 3, 0.03), []);
  const palette = useMemo(
    () => ({
      groups: TAXON_COLORS.map((c) => new THREE.Color(c)),
      bases: Object.fromEntries(Object.entries(BASE_COLORS).map(([k, v]) => [k, new THREE.Color(v)])),
      unknown: new THREE.Color(UNKNOWN_BASE_COLOR),
    }),
    []
  );
  // Starts below its first pose so the helix glides into place on load
  const current = useRef<HelixPose>({ ...poses[0], y: poses[0].y - 7, tilt: poses[0].tilt - 0.5 });
  const phase = useRef(0);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Instance colours must exist before the first render, or the material compiles without them
  useLayoutEffect(() => {
    const m = mesh.current;
    if (!m) return;
    pairs.forEach((p, i) => {
      m.setColorAt(i * 2, p.glass[0]);
      m.setColorAt(i * 2 + 1, p.glass[1]);
    });
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [pairs]);

  useFrame((state, delta) => {
    const m = mesh.current;
    const g = group.current;
    if (!m || !g) return;
    const dt = Math.min(delta, 0.1);

    const s = THREE.MathUtils.clamp(stage.current, 0, poses.length - 1);
    const a = Math.floor(s);
    const b = Math.min(a + 1, poses.length - 1);
    const f = smoothstep(s - a);
    const cur = current.current;
    for (const key of POSE_KEYS) {
      const target = THREE.MathUtils.lerp(poses[a][key], poses[b][key], f);
      cur[key] = animate ? damp(cur[key], target, 3.2, dt) : target;
    }
    phase.current += dt * 0.18 * speed;

    // Poses are authored for a 16:10 screen; narrower screens keep the same relative position, smaller
    const widthRatio = Math.min(1, state.size.width / state.size.height / 1.6);
    g.position.set(cur.x * widthRatio, cur.y, cur.z);
    g.rotation.set(pointer.current.y * 0.08, pointer.current.x * 0.12, cur.tilt);
    g.scale.setScalar(cur.scale * Math.max(widthRatio, 0.55));

    const twist = TWIST * (1 - cur.unwind * 0.9);
    const gap = 0.012 + cur.unwind * 0.05;
    for (let i = 0; i < PAIRS; i++) {
      const p = pairs[i];
      helixQuat.setFromAxisAngle(Y_AXIS, i * twist + phase.current);
      const clusterAngle = (p.group / TAXON_COLORS.length) * Math.PI * 2 + Math.PI / 2 + phase.current * 0.6;
      for (let h = 0; h < 2; h++) {
        const side = h === 0 ? -1 : 1;
        // Helix: the two nucleotides of a pair sit either side of the axis, facing each other
        helixPos.set(side * (HALF / 2 + gap), 0, 0).applyQuaternion(helixQuat);
        helixPos.y += (i - (PAIRS - 1) / 2) * RISE;
        // Sorted: the pair floats in its taxon's cluster on a ring around the centre
        offset.set(side * (HALF / 2 + gap) * 0.5, 0, 0).applyQuaternion(p.tumble);
        sortPos
          .set(Math.cos(clusterAngle) * CLUSTER_RADIUS, Math.sin(clusterAngle) * CLUSTER_RADIUS, 0)
          .add(p.jitter)
          .add(offset);

        tmpObject.position.lerpVectors(helixPos, sortPos, cur.sort);
        tmpObject.quaternion.slerpQuaternions(helixQuat, p.tumble, cur.sort);
        tmpObject.scale.setScalar(1 - cur.sort * 0.35);
        tmpObject.updateMatrix();
        m.setMatrixAt(i * 2 + h, tmpObject.matrix);

        tmpColor
          .copy(p.glass[h])
          .lerp(palette.bases[p.letters[h]] ?? palette.unknown, cur.tint)
          .lerp(palette.groups[p.group], cur.sort);
        m.setColorAt(i * 2 + h, tmpColor);
      }
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={group}>
      <instancedMesh ref={mesh} args={[geometry, undefined, PAIRS * 2]} frustumCulled={false}>
        <meshPhysicalMaterial
          color="#ffffff"
          roughness={0.16}
          metalness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.08}
          iridescence={1}
          iridescenceIOR={1.45}
          iridescenceThicknessRange={[120, 520]}
          envMapIntensity={1.4}
        />
      </instancedMesh>
    </group>
  );
}

/** With continuous animation off (reduced motion), draw a frame only when the page scrolls */
function RenderOnScroll() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const onChange = () => invalidate();
    window.addEventListener('scroll', onChange, { passive: true });
    window.addEventListener('resize', onChange);
    return () => {
      window.removeEventListener('scroll', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, [invalidate]);
  return null;
}

export default function GlassHelix({
  stage,
  poses,
  bases,
  animate,
  gentle = false,
}: {
  /** fractional index into `poses`, written by the page on scroll */
  stage: MutableRefObject<number>;
  poses: HelixPose[];
  /** real sequence used for the nucleotide colours */
  bases: string;
  animate: boolean;
  /** reduced motion while visible: keep spinning slowly and following the pointer */
  gentle?: boolean;
}) {
  const pointer = useWindowPointer();
  const { speed, frameloop } = sceneMotion({ animate, gentle });
  // Drops the render resolution on slow GPUs, raises it again when there is headroom
  const [dpr, setDpr] = useState(1.5);
  return (
    <Canvas
      dpr={dpr}
      frameloop={frameloop}
      camera={{ position: [0, 0, 11], fov: 35, near: 0.1, far: 50 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      aria-hidden="true"
    >
      <PerformanceMonitor
        bounds={() => [45, 60]}
        onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.75))}
        onDecline={() => setDpr(1)}
        flipflops={3}
        onFallback={() => setDpr(0.8)}
      />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 5]} intensity={1.4} />
      <directionalLight position={[-5, -2, 3]} intensity={0.6} color="#a5f3fc" />
      {/* Coloured light panels: the glass reflects them as the rainbow sheen */}
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.5} color="#ffffff" position={[0, 6, 0]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={3} color="#67e8f9" position={[-6, 0, 2]} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={3} color="#c4b5fd" position={[6, 0, 2]} scale={[10, 3, 1]} />
        <Lightformer form="ring" intensity={2.5} color="#f9a8d4" position={[0, -1, -6]} scale={6} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[0, 0, 8]} scale={[10, 10, 1]} />
      </Environment>
      <Strand stage={stage} poses={poses} bases={bases} animate={animate} speed={speed} pointer={pointer} />
      {frameloop === 'demand' && <RenderOnScroll />}
    </Canvas>
  );
}
