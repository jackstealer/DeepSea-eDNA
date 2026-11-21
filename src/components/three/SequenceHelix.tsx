import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Helix } from './Helix';
import { damp } from './shared';
import { sceneMotion } from './Scene3DGate';

export type HelixState = 'idle' | 'loading' | 'done';

const SPEED: Record<HelixState, number> = { idle: 0.35, loading: 3.2, done: 0.6 };
const PLACEHOLDER = 'ACGTTGCAACGTAGCTTACGGATCCATGCAATGCGTACGATCGA';

function SpinningHelix({ bases, state, motion }: { bases: string; state: HelixState; motion: number }) {
  const group = useRef<THREE.Group>(null);
  const speed = useRef(SPEED.idle);

  useFrame((frame, delta) => {
    if (!group.current || !motion) return;
    speed.current = damp(speed.current, SPEED[state], 3, delta);
    group.current.rotation.y += delta * speed.current * motion; // spin around the helix axis
    group.current.position.x = Math.sin(frame.clock.elapsedTime * 0.8) * 0.05 * motion;
  });

  const placeholder = bases.length === 0;
  return (
    // Lay the helix horizontally (and tilt it slightly towards the viewer) so it fits a wide card
    <group rotation={[0.35, 0, Math.PI / 2]}>
      <group ref={group}>
        <Helix
          bases={placeholder ? PLACEHOLDER : bases}
          radius={0.5}
          rise={0.12}
          twist={0.5}
          nodeSize={0.06}
          glowSize={0.42}
          intensity={placeholder ? 0.35 : 1}
        />
      </group>
    </group>
  );
}

/** First bases of the user's sequence as a rotating 3D double helix (A/C/G/T colour coded) */
export default function SequenceHelix({
  bases,
  state,
  animate,
  gentle = false,
}: {
  bases: string;
  state: HelixState;
  animate: boolean;
  /** reduced motion while visible: keep spinning, slower */
  gentle?: boolean;
}) {
  const { speed, frameloop } = sceneMotion({ animate, gentle });
  return (
    <Canvas
      dpr={[1, 1.75]}
      frameloop={frameloop}
      camera={{ position: [0, 0, 3.7], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
      aria-hidden="true"
    >
      <SpinningHelix bases={bases} state={state} motion={speed} />
    </Canvas>
  );
}
