import React, { useRef, useState } from 'react';
import { Color, Mesh, MeshBasicMaterial } from 'three';
import { Vector3Arr } from '../util';
import { Text } from '@react-three/drei';
import { teal } from '../../utils/palette';
import { useFrame } from '@react-three/fiber';

type ExplosionProps = {
  initialSize: number;
  scaleSpeed: number;
  position?: Vector3Arr;
  progressNormalized: number;
  autoPlay?: boolean;
};

const colors = [
  '#FEFDED',
  '#F2E697',
  '#EEDE76',
  '#EACF51',
  '#EEA940', // when explosion is here, then...
  '#F38730',
  '#F57728',
  '#F76822',
  '#D01E06',
  '#9D1B0C',
  '#741A12', // ... start smoke here
  '#621914',
  '#621914',
  '#2a161b',
].map((s) => new Color(s));

const smokeStartColorIndex = 10;

const withinColors = (index: number) =>
  Math.max(Math.min(index, colors.length - 1), 0);

const AUTOPLAY_FRAMES = 180; // 60fps over 3s assumed

export const ThreeExplosionNode: React.FC<ExplosionProps> = ({
  initialSize,
  scaleSpeed,
  position,
  progressNormalized: progressNormalizedExt = 0.0,
  autoPlay = false,
}) => {
  const blastMesh = useRef<Mesh>();
  const smokeMesh = useRef<Mesh>();
  const [progressNormalized, setProgressNormalized] = useState(
    progressNormalizedExt
  );
  useFrame(() => {
    if (autoPlay) {
      if (blastMesh.current) {
        blastMesh.current.userData.framesPassed =
          blastMesh.current.userData.framesPassed || 0;
        if (blastMesh.current.userData.framesPassed > AUTOPLAY_FRAMES) {
          setProgressNormalized(0);
          blastMesh.current.userData.framesPassed = 0;
        } else {
          blastMesh.current.userData.framesPassed += 1;
          setProgressNormalized(
            blastMesh.current.userData.framesPassed / AUTOPLAY_FRAMES
          );
        }
      }
    }
  });

  const SMOKE_DECAY_START_PROGRESS = 0.5;
  const blastColorIndex = withinColors(
    Math.floor(progressNormalized * colors.length) - 1
  );
  const nextBlastColorIndex = Math.min(blastColorIndex + 1, colors.length - 1);
  const blastColorLerpRatio = (progressNormalized * colors.length) % 1;

  const smokeColorIndex = withinColors(
    Math.floor(
      (progressNormalized - SMOKE_DECAY_START_PROGRESS) * colors.length
    ) -
      1 +
      smokeStartColorIndex
  );
  const nextSmokeColorIndex = Math.min(smokeColorIndex + 1, colors.length - 1);
  const smokeColorLerpRatio =
    ((progressNormalized - SMOKE_DECAY_START_PROGRESS) * colors.length) % 1;

  return (
    <group
      position={position}
      visible={progressNormalized <= 1 && progressNormalized > 0}
    >
      {/* blast */}
      <mesh ref={blastMesh} scale={scaleSpeed ** (60 * progressNormalized)}>
        <circleBufferGeometry args={[initialSize, 256]} />
        {/*<sphereBufferGeometry args={[100, 256, 256]} />*/}
        <meshBasicMaterial
          color={colors[blastColorIndex]
            .clone()
            .lerp(colors[nextBlastColorIndex], blastColorLerpRatio)}
        />
      </mesh>
      {/* smoke */}
      <mesh
        ref={smokeMesh}
        visible={progressNormalized >= SMOKE_DECAY_START_PROGRESS}
        scale={
          (scaleSpeed * 1.05) **
          (60 * (progressNormalized - SMOKE_DECAY_START_PROGRESS))
        }
      >
        <circleBufferGeometry args={[initialSize, 256]} />
        <meshBasicMaterial
          color={colors[smokeColorIndex]
            .clone()
            .lerp(colors[nextSmokeColorIndex], smokeColorLerpRatio)}
        />
      </mesh>
    </group>
  );
};

export const BackgroundPlane = () => {};
