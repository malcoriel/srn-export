import React, { useRef, useState } from 'react';
import { Color, Mesh, MeshBasicMaterial } from 'three';
import { Vector3Arr } from '../util';
import { useFrame } from '@react-three/fiber';

type ExplosionProps = {
  initialSize: number;
  scaleSpeed: number;
  position?: Vector3Arr;
  progressNormalized: number;
  autoPlay?: boolean;
  // this will only control autoPlay!
  // the explosions 'fastness' is controlled by the
  // way progressNormalized is increased
  explosionTimeSeconds?: number;
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

// this is some magic constant I initially used for scaling, seems necessary
const ADJ = 60;

export const ThreeExplosionNode: React.FC<ExplosionProps> = ({
  initialSize,
  scaleSpeed,
  position,
  progressNormalized: progressNormalizedExt = 0.0,
  autoPlay = false,
  explosionTimeSeconds = 4,
}) => {
  const blastMesh = useRef<Mesh>();
  const smokeMesh = useRef<Mesh>();
  const [progressNormalized, setProgressNormalized] = useState(
    progressNormalizedExt
  );
  useFrame((_state, deltaSeconds) => {
    if (autoPlay) {
      if (blastMesh.current) {
        blastMesh.current.userData.secondsPassed =
          blastMesh.current.userData.secondsPassed || 0;
        if (blastMesh.current.userData.secondsPassed > explosionTimeSeconds) {
          setProgressNormalized(0);
          blastMesh.current.userData.secondsPassed = 0;
        } else {
          blastMesh.current.userData.secondsPassed += deltaSeconds;
          const newProgress =
            blastMesh.current.userData.secondsPassed / explosionTimeSeconds;
          setProgressNormalized(newProgress);
        }
      }
    } else {
      setProgressNormalized(progressNormalizedExt);
    }
  });

  const SMOKE_DECAY_START_PROGRESS = 0.5; // when explosion is 50% through
  const SMOKE_DECAY_INITIAL_SIZE_RATIO = 0.3; // create a smoke decay with currentSize * ratio
  const SMOKE_DECAY_SPEED_MULTIPLIER = 1.05; // that has base exponent multiplied by that
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

  const initialSmokeDecaySize =
    initialSize *
    scaleSpeed ** (1 + SMOKE_DECAY_START_PROGRESS * ADJ) *
    SMOKE_DECAY_INITIAL_SIZE_RATIO;

  const blastCurrentScale = scaleSpeed ** (1 + progressNormalized * ADJ);
  const blastCurrentSize = initialSize * blastCurrentScale;
  let smokeDecayCurrentScale =
    (scaleSpeed * SMOKE_DECAY_SPEED_MULTIPLIER) **
    (1 + (progressNormalized - SMOKE_DECAY_START_PROGRESS) * ADJ);
  const smokeDecayCurrentSize = initialSmokeDecaySize * smokeDecayCurrentScale;
  // smoke decay cannot go higher than the explosion itself, so we have to adjust the scale
  // based on invariant smokeDecayCurrentSize <= blastCurrentSize

  if (smokeDecayCurrentSize > blastCurrentSize) {
    // if i1 * s1 < i2 * s2, then i1 * s1 = i2 * s2 * (some x)
    // so to make them equal, we just have to find what is x and multiply by it
    const x =
      (initialSize * blastCurrentScale) /
      (initialSmokeDecaySize * smokeDecayCurrentScale);
    smokeDecayCurrentScale *= x;
  }

  return (
    <group
      position={position}
      visible={progressNormalized <= 1 && progressNormalized > 0}
    >
      {/* blast */}
      <mesh ref={blastMesh} scale={blastCurrentScale}>
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
        scale={smokeDecayCurrentScale}
      >
        <circleBufferGeometry args={[initialSmokeDecaySize, 256]} />
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
