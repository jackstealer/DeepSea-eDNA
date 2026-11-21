import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Line, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { TaxonReference } from '@/data/taxaReference';
import { damp, getGlowTexture } from './shared';
import { sceneMotion } from './Scene3DGate';

const PALETTE = {
  dark: { Chordata: '#22d3ee', Arthropoda: '#f59e0b', Mollusca: '#2dd4bf', root: '#e2e8f0', ring: '#334155' },
  light: { Chordata: '#0891b2', Arthropoda: '#d97706', Mollusca: '#0d9488', root: '#334155', ring: '#cbd5e1' },
};

const LEAF_RADIUS = 4;
const DEPTH_RADIUS = [0, 1.55, 2.85];

interface TreeNode {
  key: string;
  name: string;
  depth: number;
  phylum: string;
  parent: TreeNode | null;
  children: TreeNode[];
  taxon?: TaxonReference;
  angle: number;
  position: THREE.Vector3;
}

/** Radial tree from the taxa lineages: Animalia -> phylum -> class -> order, taxa on the outer ring */
function buildTree(taxa: TaxonReference[]): TreeNode[] {
  const root: TreeNode = {
    key: 'Animalia', name: 'Animalia', depth: 0, phylum: '', parent: null, children: [], angle: 0,
    position: new THREE.Vector3(),
  };
  for (const taxon of taxa) {
    let node = root;
    taxon.lineage.slice(1).forEach((level, i) => {
      const key = taxon.lineage.slice(0, i + 2).join('/');
      let child = node.children.find((c) => c.key === key);
      if (!child) {
        child = {
          key, name: level, depth: i + 1, phylum: taxon.lineage[1], parent: node, children: [], angle: 0,
          position: new THREE.Vector3(),
        };
        node.children.push(child);
      }
      node = child;
    });
    node.taxon = taxon;
  }

  const leaves: TreeNode[] = [];
  const collect = (n: TreeNode) => (n.children.length ? n.children.forEach(collect) : leaves.push(n));
  collect(root);
  leaves.forEach((leaf, i) => {
    leaf.angle = (i / leaves.length) * Math.PI * 2;
  });
  const place = (n: TreeNode) => {
    n.children.forEach(place);
    if (n.children.length) n.angle = n.children.reduce((s, c) => s + c.angle, 0) / n.children.length;
    const radius = n.children.length ? DEPTH_RADIUS[n.depth] ?? LEAF_RADIUS : LEAF_RADIUS;
    const y = n.children.length ? 0 : Math.sin(n.angle * 3) * 0.45;
    n.position.set(Math.cos(n.angle) * radius, y, Math.sin(n.angle) * radius);
  };
  place(root);

  const all: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    all.push(n);
    n.children.forEach(walk);
  };
  walk(root);
  return all;
}

function nodeSize(n: TreeNode, maxCount: number): number {
  if (n.taxon) return 0.12 + 0.16 * Math.sqrt(n.taxon.trainingCount / maxCount);
  return n.depth === 0 ? 0.13 : 0.06;
}

function TaxonNode({
  node,
  size,
  color,
  dark,
  selected,
  hovered,
  onHover,
  onSelect,
}: {
  node: TreeNode;
  size: number;
  color: string;
  dark: boolean;
  selected: boolean;
  hovered: boolean;
  onHover: (name: string | null) => void;
  onSelect: (name: string) => void;
}) {
  const mesh = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const taxon = node.taxon!;

  useFrame((state, delta) => {
    if (mesh.current) {
      const target = hovered ? 1.3 : selected ? 1.15 : 1;
      mesh.current.scale.setScalar(damp(mesh.current.scale.x, target, 8, delta));
    }
    if (ring.current) {
      ring.current.lookAt(state.camera.position);
      ring.current.rotateZ(state.clock.elapsedTime * 0.8);
    }
  });

  return (
    <group position={node.position}>
      <group ref={mesh}>
        <mesh
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(taxon.name);
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(taxon.name);
          }}
        >
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={dark ? 0.9 : 0.25} roughness={0.35} />
        </mesh>
        {dark && (
          <sprite scale={size * 7}>
            <spriteMaterial
              map={getGlowTexture()}
              color={color}
              transparent
              opacity={hovered || selected ? 0.75 : 0.4}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        )}
      </group>
      {selected && (
        <mesh ref={ring}>
          <torusGeometry args={[size * 1.9, 0.012, 8, 64]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Small lights travelling along every lineage edge, root -> leaves */
function EdgePulses({ edges, color, motion }: { edges: Array<[THREE.Vector3, THREE.Vector3]>; color: string; motion: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => new Float32Array(edges.length * 3), [edges]);
  const offsets = useMemo(() => edges.map((_, i) => (i * 0.37) % 1), [edges]);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = motion ? state.clock.elapsedTime * 0.35 * motion : 0.5;
    edges.forEach(([a, b], i) => {
      point.lerpVectors(a, b, (t + offsets[i]) % 1);
      positions.set([point.x, point.y, point.z], i * 3);
    });
    (ref.current.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        map={getGlowTexture()}
        color={color}
        size={0.22}
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/** Moves the DOM labels to their nodes' projected screen positions every frame */
function LabelProjector({
  all,
  maxCount,
  labels,
}: {
  all: TreeNode[];
  maxCount: number;
  labels: MutableRefObject<Map<string, HTMLDivElement>>;
}) {
  const { camera, size } = useThree();
  const point = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const n of all) {
      const el = labels.current.get(n.key);
      if (!el) continue;
      // Taxon names sit above their node; lineage (phylum/class) names sit below, so they don't collide
      point.copy(n.position);
      point.y += n.taxon ? nodeSize(n, maxCount) + 0.12 : -(nodeSize(n, maxCount) + 0.06);
      point.project(camera);
      el.style.opacity = point.z < 1 ? '1' : '0';
      el.style.transform = `translate3d(${((point.x * 0.5 + 0.5) * size.width).toFixed(1)}px, ${(
        (-point.y * 0.5 + 0.5) * size.height
      ).toFixed(1)}px, 0) translate(-50%, ${n.taxon ? '-100%' : '0'})`;
    }
  });
  return null;
}

function Constellation({
  all,
  maxCount,
  selected,
  onSelect,
  motion,
  dark,
  hovered,
  setHovered,
}: {
  all: TreeNode[];
  maxCount: number;
  selected: string;
  onSelect: (name: string) => void;
  motion: number;
  dark: boolean;
  hovered: string | null;
  setHovered: (name: string | null) => void;
}) {
  const palette = dark ? PALETTE.dark : PALETTE.light;
  const edges = useMemo(
    () => all.filter((n) => n.parent).map((n) => [n.parent!.position, n.position] as [THREE.Vector3, THREE.Vector3]),
    [all]
  );
  const colorOf = (n: TreeNode) => (palette as Record<string, string>)[n.phylum] ?? palette.root;

  return (
    <group>
      {/* Orbit rings for each taxonomic depth */}
      {[...DEPTH_RADIUS.slice(1), LEAF_RADIUS].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <ringGeometry args={[r - 0.006, r + 0.006, 128]} />
          <meshBasicMaterial color={palette.ring} transparent opacity={dark ? 0.6 : 0.9} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {all
        .filter((n) => n.parent)
        .map((n) => {
          const active = n.taxon ? n.taxon.name === selected || n.taxon.name === hovered : false;
          return (
            <Line
              key={n.key}
              points={[n.parent!.position, n.position]}
              color={colorOf(n)}
              lineWidth={active ? 2 : 1}
              transparent
              opacity={active ? 0.9 : dark ? 0.35 : 0.5}
            />
          );
        })}
      {dark && <EdgePulses edges={edges} color="#a5f3fc" motion={motion} />}

      {all.map((n) =>
        n.taxon ? (
          <TaxonNode
            key={n.key}
            node={n}
            size={nodeSize(n, maxCount)}
            color={colorOf(n)}
            dark={dark}
            selected={n.taxon.name === selected}
            hovered={n.taxon.name === hovered}
            onHover={setHovered}
            onSelect={onSelect}
          />
        ) : (
          <mesh key={n.key} position={n.position}>
            <sphereGeometry args={[nodeSize(n, maxCount), 24, 24]} />
            <meshBasicMaterial color={n.depth === 0 ? palette.root : colorOf(n)} toneMapped={false} />
          </mesh>
        )
      )}
    </group>
  );
}

export default function TaxaConstellation({
  taxa,
  selected,
  onSelect,
  animate,
  gentle = false,
  dark,
}: {
  taxa: TaxonReference[];
  selected: string;
  onSelect: (name: string) => void;
  animate: boolean;
  /** reduced motion while visible: keep rotating on its own, slower */
  gentle?: boolean;
  dark: boolean;
}) {
  const { speed: motion, frameloop } = sceneMotion({ animate, gentle });
  const [hovered, setHovered] = useState<string | null>(null);
  const all = useMemo(() => buildTree(taxa), [taxa]);
  const maxCount = Math.max(...taxa.map((t) => t.trainingCount));
  const labels = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    return () => {
      document.body.style.cursor = '';
    };
  }, [hovered]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.75]}
        frameloop={frameloop}
        camera={{ position: [0, 5.2, 9.4], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
        aria-label="Interactive 3D taxonomy of the eight marine taxa. Drag to rotate, click a taxon to open it."
        role="img"
      >
        <ambientLight intensity={dark ? 0.5 : 1.1} />
        <directionalLight position={[4, 8, 5]} intensity={dark ? 1 : 1.6} />
        <Constellation
          all={all}
          maxCount={maxCount}
          selected={selected}
          onSelect={onSelect}
          motion={motion}
          dark={dark}
          hovered={hovered}
          setHovered={setHovered}
        />
        <LabelProjector all={all} maxCount={maxCount} labels={labels} />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          enableDamping
          autoRotate={motion > 0 && !hovered}
          autoRotateSpeed={0.55 * motion}
          minPolarAngle={0.55}
          maxPolarAngle={1.35}
          rotateSpeed={0.6}
        />
      </Canvas>

      {/* Labels: one plain DOM layer positioned from the 3D nodes (sturdier than a React root per label) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {all.map((n) => {
          const active = n.taxon && (n.taxon.name === selected || n.taxon.name === hovered);
          return (
            <div
              key={n.key}
              ref={(el) => {
                if (el) labels.current.set(n.key, el);
                else labels.current.delete(n.key);
              }}
              className="absolute left-0 top-0 flex flex-col items-center whitespace-nowrap select-none will-change-transform"
            >
              {n.taxon ? (
                <>
                  <span
                    className={`text-[11px] font-semibold tracking-tight ${
                      n.taxon.name === selected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {n.taxon.name}
                  </span>
                  {active && (
                    <span className="mt-0.5 rounded bg-white/90 dark:bg-slate-900/90 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-300 shadow-sm">
                      {n.taxon.trainingCount.toLocaleString()} seqs · recall{' '}
                      {n.taxon.validation ? `${(n.taxon.validation.recall * 100).toFixed(1)}%` : '—'}
                    </span>
                  )}
                </>
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                  {n.name}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
