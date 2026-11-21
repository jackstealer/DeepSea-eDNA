import { useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, Line, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import { Helix } from './Helix';
import { damp, fbm, getGlowTexture, useWindowPointer, type PointerRef } from './shared';
import { sceneMotion } from './Scene3DGate';

export interface HeroStat {
  value: string;
  label: string;
}

const BACKGROUND = '#070D19';
const ORB_RADIUS = 1.25;
// A real cod COI fragment gives the helix in the orb genuine base colours
const ORB_BASES = 'ACCCTTTATCTCGTATTTGGTGCCTGAGCCGGCATAGT';


/** Faceted, fog-softened abyssal ridges that rise toward the sides and back */
function Seafloor() {
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(46, 28, 150, 95);
    plane.rotateX(-Math.PI / 2);
    const positions = plane.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const ridged = 1 - Math.abs(fbm(x * 0.11 + 3.1, z * 0.11 + 7.3) * 2 - 1);
      const sides = Math.pow(Math.min(1, Math.abs(x) / 15), 1.5);
      const back = THREE.MathUtils.clamp((-z - 2) / 11, 0, 1);
      const valley = Math.exp(-(x * x + (z + 1) * (z + 1)) / 20) * 1.1;
      const height = fbm(x * 0.32, z * 0.32) * 0.8 + ridged * ridged * (1 + sides * 5 + back * 3.6) - valley;
      positions.setY(i, height);
    }
    plane.computeVertexNormals();
    return plane;
  }, []);

  return (
    <mesh geometry={geometry} position={[0, -3, -3]}>
      <meshStandardMaterial color="#2a4668" roughness={0.85} metalness={0.1} flatShading />
    </mesh>
  );
}

/** Volumetric-looking cone of light falling onto the orb (additive, fades with height) */
function LightShaft() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color('#a5f3fc') } },
        vertexShader: `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float alpha = smoothstep(0.0, 0.45, vUv.y) * pow(1.0 - vUv.y, 0.6) * 0.11;
            gl_FragColor = vec4(uColor, alpha);
          }
        `,
      }),
    []
  );
  return (
    <mesh position={[0, 3.6, 0]} material={material}>
      <coneGeometry args={[2.1, 6, 64, 1, true]} />
    </mesh>
  );
}

/** Fresnel rim glow around the glass orb */
function RimGlow() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uColor: { value: new THREE.Color('#22d3ee') } },
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vNormal = normalize(normalMatrix * normal);
            vView = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            float fresnel = pow(1.0 - abs(dot(vNormal, vView)), 3.0);
            gl_FragColor = vec4(uColor * fresnel * 1.6, fresnel);
          }
        `,
      }),
    []
  );
  return (
    <mesh material={material} scale={1.03}>
      <sphereGeometry args={[ORB_RADIUS, 64, 64]} />
    </mesh>
  );
}

/** Points on the orb surface (like the reference's numbered data markers) */
const ANCHORS: Array<[number, number, number]> = [
  [-0.62, 0.52, 0.58],
  [0.58, 0.46, 0.67],
  [0.52, -0.5, 0.69],
  [-0.48, -0.46, 0.75],
].map(([x, y, z]) => {
  const v = new THREE.Vector3(x, y, z).normalize().multiplyScalar(ORB_RADIUS * 1.02);
  return [v.x, v.y, v.z];
});

function StatMarker({ index, stat, side }: { index: number; stat: HeroStat; side: 'left' | 'right' }) {
  return (
    <div
      className={`flex items-center gap-2 whitespace-nowrap ${side === 'left' ? 'flex-row-reverse' : ''}`}
      style={{ transform: `translate(${side === 'left' ? 'calc(-100% + 5px)' : '-5px'}, -50%)` }}
    >
      <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_12px_3px_rgba(34,211,238,0.65)]" />
      <span className="h-px w-6 bg-cyan-300/50" />
      <span className={`flex flex-col ${side === 'left' ? 'items-end text-right' : ''}`}>
        <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300/80">{String(index + 1).padStart(2, '0')}</span>
        <span className="font-mono text-sm font-semibold text-white tabular-nums">{stat.value}</span>
        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400">{stat.label}</span>
      </span>
    </div>
  );
}

function Orb({
  pointer,
  animate,
  speed,
  markers,
}: {
  pointer: PointerRef;
  animate: boolean;
  /** ambient motion speed: 1 full, 1/3 under reduced motion, 0 paused */
  speed: number;
  markers: MutableRefObject<Array<HTMLDivElement | null>>;
}) {
  const group = useRef<THREE.Group>(null);
  const helix = useRef<THREE.Group>(null);
  const { viewport, size, camera } = useThree();
  const projected = useMemo(() => new THREE.Vector3(), []);
  const wide = size.width >= 640;
  // Upper part of the panel (the copy is docked bottom-left), leaving room for the side labels
  const baseX = wide ? Math.min(viewport.width * 0.1, 0.8) : 0;
  const baseY = wide ? Math.min(viewport.height * 0.2, 1.25) : 1.15;
  const baseScale = wide ? 0.78 : 0.6;

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const intro = animate ? 1 - Math.pow(1 - Math.min(1, t / 1.8), 3) : 1;
    g.scale.setScalar(baseScale * (0.75 + 0.25 * intro));
    g.position.set(baseX, baseY + Math.sin(t * 0.6) * 0.08 * speed, 0);
    g.rotation.x = damp(g.rotation.x, -pointer.current.y * 0.22, 2.5, delta);
    g.rotation.y = damp(g.rotation.y, pointer.current.x * 0.38, 2.5, delta);
    if (helix.current) helix.current.rotation.y += delta * 0.45 * speed;

    // Pin the HTML stat markers to their anchor points on the orb
    g.updateMatrixWorld();
    ANCHORS.forEach((anchor, i) => {
      const el = markers.current[i];
      if (!el) return;
      projected.set(anchor[0], anchor[1], anchor[2]).applyMatrix4(g.matrixWorld).project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.opacity = String(intro);
    });
  });

  const loop = useMemo(() => [...ANCHORS, ANCHORS[0]], []);

  return (
    <group ref={group}>
      <LightShaft />
      <pointLight color="#22d3ee" intensity={18} distance={10} decay={1.6} />

      {/* Glass shell */}
      <mesh>
        <sphereGeometry args={[ORB_RADIUS, 96, 96]} />
        <meshPhysicalMaterial
          color="#d8f6ff"
          transmission={1}
          thickness={0.25}
          roughness={0.05}
          ior={1.14}
          clearcoat={1}
          clearcoatRoughness={0.08}
          attenuationColor="#67e8f9"
          attenuationDistance={3}
          envMapIntensity={1.4}
        />
      </mesh>
      <RimGlow />

      {/* The DNA inside the orb */}
      <group ref={helix} rotation={[0.18, 0, 0.12]}>
        <Helix bases={ORB_BASES} radius={0.38} rise={0.052} twist={0.42} nodeSize={0.032} glowSize={0.24} />
      </group>

      {/* Numbered data markers joined by thin lines */}
      <Line points={loop} color="#67e8f9" lineWidth={1} transparent opacity={0.35} dashed dashSize={0.06} gapSize={0.05} />
    </group>
  );
}

/** Slowly sinking "marine snow" particles */
function MarineSnow({ count = 900, speed }: { count?: number; speed: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, speeds } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 26;
      p[i * 3 + 1] = Math.random() * 10 - 3.5;
      p[i * 3 + 2] = (Math.random() - 0.5) * 16 - 2;
      s[i] = 0.05 + Math.random() * 0.18;
    }
    return { positions: p, speeds: s };
  }, [count]);

  useFrame((state, delta) => {
    if (!speed || !ref.current) return;
    const attr = ref.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < count; i++) {
      let y = attr.getY(i) - speeds[i] * delta * speed;
      if (y < -3.5) y = 6.5;
      attr.setY(i, y);
      attr.setX(i, attr.getX(i) + Math.sin(t * 0.4 + i) * 0.0015);
    }
    attr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getGlowTexture()}
        color="#bae6fd"
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.55}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function CameraRig({ pointer }: { pointer: PointerRef }) {
  useFrame((state, delta) => {
    const camera = state.camera;
    camera.position.x = damp(camera.position.x, pointer.current.x * 0.7, 1.6, delta);
    camera.position.y = damp(camera.position.y, 0.35 + pointer.current.y * 0.35, 1.6, delta);
    camera.lookAt(0, 0.15, 0);
  });
  return null;
}

export default function AbyssHero({
  stats,
  animate,
  gentle = false,
}: {
  stats: HeroStat[];
  animate: boolean;
  /** reduced motion while visible: calmer, but still alive and following the pointer */
  gentle?: boolean;
}) {
  const pointer = useWindowPointer();
  const { speed, frameloop } = sceneMotion({ animate, gentle });
  const markers = useRef<Array<HTMLDivElement | null>>([]);
  // Drops the render resolution on slow GPUs, raises it again when there is headroom
  const [dpr, setDpr] = useState(1.5);
  return (
    <>
      <Canvas
        className="!absolute inset-0"
        dpr={dpr}
        frameloop={frameloop}
        camera={{ position: [0, 0.35, 8], fov: 38, near: 0.1, far: 60 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        aria-hidden="true"
      >
        <PerformanceMonitor
          bounds={() => [45, 60]}
          onIncline={() => setDpr(Math.min(window.devicePixelRatio, 1.75))}
          onDecline={() => setDpr(1)}
          flipflops={3}
          onFallback={() => setDpr(0.8)}
        />
        <color attach="background" args={[BACKGROUND]} />
        <fog attach="fog" args={[BACKGROUND, 9, 34]} />
        <ambientLight intensity={0.35} color="#7dd3fc" />
        <directionalLight position={[3, 9, 5]} intensity={1.5} color="#dbeafe" />
        <directionalLight position={[-6, 2, -4]} intensity={0.4} color="#22d3ee" />
        {/* Back light catching the ridge lines */}
        <directionalLight position={[0, 4, -12]} intensity={1.2} color="#7dd3fc" />

        <Environment resolution={128} frames={1}>
          <Lightformer form="ring" intensity={3} color="#67e8f9" position={[0, 5, -4]} scale={5} />
          <Lightformer form="rect" intensity={1.2} color="#e0f2fe" position={[-6, 3, 2]} scale={[1.2, 4, 1]} />
          <Lightformer form="circle" intensity={0.8} color="#0ea5e9" position={[6, -1, 2]} scale={1.5} />
        </Environment>

        <Seafloor />
        <Orb pointer={pointer} animate={animate} speed={speed} markers={markers} />
        <MarineSnow speed={speed} />
        <CameraRig pointer={pointer} />
      </Canvas>

      {/* Stat markers: plain DOM, moved every frame to the projected anchor points */}
      <div className="pointer-events-none absolute inset-0 hidden md:block" aria-hidden="true">
        {stats.slice(0, ANCHORS.length).map((stat, i) => (
          <div
            key={stat.label}
            ref={(el) => {
              markers.current[i] = el;
            }}
            className="absolute left-0 top-0 opacity-0 will-change-transform"
          >
            <StatMarker index={i} stat={stat} side={ANCHORS[i][0] < 0 ? 'left' : 'right'} />
          </div>
        ))}
      </div>
    </>
  );
}
