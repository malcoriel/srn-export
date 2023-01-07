import React, { useRef, useState } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { ExplosionProps } from './ThreeExplosionNode';

export const ThreeExplosionNodeV2: React.FC<ExplosionProps> = ({
  initialSize,
  scaleSpeed,
  position,
  progressNormalized: progressNormalizedExt = 0.0,
  autoPlay = false,
  explosionTimeSeconds = 4,
}) => {
  const blastMesh = useRef<Mesh>();
  useFrame((_state, deltaSeconds) => {});

  return (
    <group position={position}>
      <mesh ref={blastMesh} scale={1.0}>
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial color="red" />
      </mesh>
      <mesh ref={blastMesh} scale={1.0} position={[0, 0, -1]}>
        <planeGeometry args={[110, 110]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
};
