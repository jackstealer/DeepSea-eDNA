import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BASE_COLORS, COMPLEMENT, UNKNOWN_BASE_COLOR, getGlowTexture } from './shared';

interface HelixProps {
  /** One letter per base pair, e.g. "ACGT..." (others render grey) */
  bases: string;
  radius?: number;
  /** distance between base pairs along the axis */
  rise?: number;
  /** rotation between consecutive base pairs (radians) */
  twist?: number;
  nodeSize?: number;
  glowSize?: number;
  /** 0..1, fades unknown/placeholder helices */
  intensity?: number;
}

const tmpObject = new THREE.Object3D();
const tmpColor = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Double helix along the Y axis: two backbones of glowing nucleotides plus base-pair rungs.
 * Instanced meshes keep it to a handful of draw calls regardless of length.
 */
export function Helix({
  bases,
  radius = 0.45,
  rise = 0.065,
  twist = 0.42,
  nodeSize = 0.045,
  glowSize = 0.32,
  intensity = 1,
}: HelixProps) {
  const count = Math.max(bases.length, 1);
  const nodesRef = useRef<THREE.InstancedMesh>(null);
  const rungsRef = useRef<THREE.InstancedMesh>(null);

  const glowGeometry = useMemo(() => new THREE.BufferGeometry(), []);
  const glowTexture = useMemo(() => getGlowTexture(), []);

  useLayoutEffect(() => {
    const nodes = nodesRef.current;
    const rungs = rungsRef.current;
    if (!nodes || !rungs) return;
    const height = (count - 1) * rise;
    const glowPositions = new Float32Array(count * 2 * 3);
    const glowColors = new Float32Array(count * 2 * 3);
    const direction = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const base = bases[i]?.toUpperCase() ?? 'N';
      const pair = COMPLEMENT[base] ?? 'N';
      const angle = i * twist;
      const y = i * rise - height / 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      [
        { sign: 1, letter: base },
        { sign: -1, letter: pair },
      ].forEach(({ sign, letter }, strand) => {
        const index = i * 2 + strand;
        tmpObject.position.set(x * sign, y, z * sign);
        tmpObject.quaternion.identity();
        tmpObject.scale.setScalar(1);
        tmpObject.updateMatrix();
        nodes.setMatrixAt(index, tmpObject.matrix);
        tmpColor.set(BASE_COLORS[letter] ?? UNKNOWN_BASE_COLOR).multiplyScalar(intensity);
        nodes.setColorAt(index, tmpColor);
        glowPositions.set([x * sign, y, z * sign], index * 3);
        glowColors.set([tmpColor.r, tmpColor.g, tmpColor.b], index * 3);
      });

      // Rung between the two strands, pointing from one nucleotide to its partner
      direction.set(x, 0, z).normalize();
      tmpObject.position.set(0, y, 0);
      tmpObject.quaternion.setFromUnitVectors(UP, direction);
      tmpObject.scale.set(1, radius * 2, 1);
      tmpObject.updateMatrix();
      rungs.setMatrixAt(i, tmpObject.matrix);
      tmpColor
        .set(BASE_COLORS[base] ?? UNKNOWN_BASE_COLOR)
        .lerp(new THREE.Color(BASE_COLORS[pair] ?? UNKNOWN_BASE_COLOR), 0.5)
        .multiplyScalar(0.55 * intensity);
      rungs.setColorAt(i, tmpColor);
    }

    nodes.instanceMatrix.needsUpdate = true;
    rungs.instanceMatrix.needsUpdate = true;
    if (nodes.instanceColor) nodes.instanceColor.needsUpdate = true;
    if (rungs.instanceColor) rungs.instanceColor.needsUpdate = true;
    nodes.computeBoundingSphere();
    rungs.computeBoundingSphere();

    glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));
    glowGeometry.setAttribute('color', new THREE.BufferAttribute(glowColors, 3));
    glowGeometry.computeBoundingSphere();
  }, [bases, count, radius, rise, twist, intensity, glowGeometry]);

  return (
    <group>
      <instancedMesh ref={nodesRef} args={[undefined, undefined, count * 2]} key={`n${count}`}>
        <sphereGeometry args={[nodeSize, 14, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={rungsRef} args={[undefined, undefined, count]} key={`r${count}`}>
        <cylinderGeometry args={[nodeSize * 0.28, nodeSize * 0.28, 1, 6]} />
        <meshBasicMaterial toneMapped={false} transparent opacity={0.8} />
      </instancedMesh>
      <points geometry={glowGeometry}>
        <pointsMaterial
          map={glowTexture}
          size={glowSize}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.55 * intensity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
