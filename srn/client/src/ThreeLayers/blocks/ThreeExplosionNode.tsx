import React, { useRef } from 'react';
import { Color, Mesh, MeshBasicMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { Vector3Arr } from '../util';
import { Text } from '@react-three/drei';
import { teal } from '../../utils/palette';

type ExplosionProps = {
  maxScale: number;
  initialSize: number;
  scaleSpeed: number;
  delay?: number;
  position?: Vector3Arr;
  progressNormalized: number;
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
const blastStartSmokeColorIndex = 4;

export const ThreeExplosionNode: React.FC<ExplosionProps> = ({
  maxScale,
  initialSize,
  scaleSpeed,
  position,
  delay,
  progressNormalized = 1.0,
}) => {
  const blastMesh = useRef<Mesh>();
  const smokeMesh = useRef<Mesh>();
  useFrame(() => {
    if (blastMesh && blastMesh.current && smokeMesh && smokeMesh.current) {
      blastMesh.current.userData = blastMesh.current.userData || {};
      blastMesh.current.userData.framesPassed =
        blastMesh.current.userData.framesPassed || 0;
      blastMesh.current.userData.framesPassed += 1;

      let shouldRender;
      if (!delay) {
        shouldRender = true;
      } else {
        shouldRender = blastMesh.current.userData.framesPassed > delay;
      }

      if (progressNormalized > 1 || progressNormalized <= 0) {
        shouldRender = false;
      }

      if (shouldRender) {
        blastMesh.current.visible = true;
        const blastColorIndex =
          Math.floor((blastMesh.current.scale.x / maxScale) * colors.length) -
          1;
        (blastMesh.current.material as MeshBasicMaterial).color =
          colors[blastColorIndex];

        let shouldRenderSmoke;
        shouldRenderSmoke = blastColorIndex >= blastStartSmokeColorIndex;
        if (smokeMesh.current.scale.x >= blastMesh.current.scale.x) {
          shouldRenderSmoke = false;
        }

        if (shouldRenderSmoke) {
          smokeMesh.current.visible = true;
          const smokeColorIndex = Math.min(
            Math.floor((smokeMesh.current.scale.x / maxScale) * colors.length) -
              1 +
              smokeStartColorIndex,
            colors.length
          );
          (smokeMesh.current.material as MeshBasicMaterial).color =
            colors[smokeColorIndex];
        } else {
          smokeMesh.current.visible = false;
        }
      } else {
        blastMesh.current.visible = false;
        smokeMesh.current.visible = false;
      }
    }
  });

  const SMOKE_DECAY_START_PROGRESS = 0.5;
  return (
    <group position={position}>
      {/* blast */}
      <mesh ref={blastMesh} scale={scaleSpeed ** (60 * progressNormalized)}>
        <circleBufferGeometry args={[initialSize, 256]} />
        {/*<sphereBufferGeometry args={[100, 256, 256]} />*/}
        <meshBasicMaterial color={colors[0]} />
      </mesh>
      {/* smoke */}
      <mesh
        ref={smokeMesh}
        visible={false}
        scale={
          (scaleSpeed * 1.05) **
          (60 * (progressNormalized - SMOKE_DECAY_START_PROGRESS))
        }
      >
        <circleBufferGeometry args={[initialSize, 256]} />
        <meshBasicMaterial color={colors[smokeStartColorIndex]} />
      </mesh>
      <Text
        position={[50, 50, 0]}
        color={teal}
        fontSize={10}
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="center"
        anchorX="center"
        anchorY="bottom" // default
      >
        {progressNormalized.toFixed(2)}
      </Text>
    </group>
  );
};

export const BackgroundPlane = () => {};
