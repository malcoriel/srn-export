import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ThreeExplosionNode } from './ThreeExplosionNode';
import Prando from 'prando';
import { variateNormal } from '../shaders/randUtils';
import { Vector3Arr } from '../util';
import _ from 'lodash';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

export type ThreeExplosionProps = {
  seed: string;
  autoPlay?: boolean;
  playOnce?: boolean;
  progressNormalized?: number;
  explosionTimeSeconds: number;
  position?: Vector3Arr;
  radius?: number;
};
type NodeParams = {
  id: string;
  initialSize: number;
  scaleSpeed: number;
  initialProgressNormalized: number;
  position: Vector3Arr;
  progressSpeedMultiplier: number;
};

export const ThreeExplosion: React.FC<ThreeExplosionProps> = ({
  seed,
  position,
  radius = 40,
  explosionTimeSeconds = 4,
  progressNormalized: globalProgressNormalized = 0.0,
  autoPlay,
  playOnce,
}) => {
  const genNode = useCallback(
    (
      maxDist: number,
      initialSizeMultiplier: number,
      minDelay: number,
      prando: Prando,
      count: number,
      i: number,
      wave: number
    ): NodeParams => {
      const r = variateNormal(0, maxDist, 5, prando);
      const theta =
        ((2 * Math.PI) / count) * (i + variateNormal(-1.0, 1.0, 0.5, prando));
      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      const scaleSpeed = variateNormal(1.03, 1.05, 0.03, prando);

      // scale is exponential with scaleSpeed as exponent base
      // scale = scaleSpeed ** (explosionTimeSeconds * progressNormalized)
      // so maxScale = scaleSpeed ** (explosionTimeSeconds * 1.0)
      // so the time to reach max scale should be
      // log(maxScale) base scaleSpeed

      const initialSize =
        variateNormal(0.5, 1.5, 0.5, prando) * radius * initialSizeMultiplier;

      const desiredDelaySeconds =
        minDelay + variateNormal(-0.5, 0.5, 0.1, prando) * explosionTimeSeconds;
      const progressShift = -desiredDelaySeconds / explosionTimeSeconds;

      return {
        id: `${wave}_${i}`,
        initialSize,
        position: [x, y, 0],
        scaleSpeed,
        initialProgressNormalized: progressShift,
        progressSpeedMultiplier: variateNormal(1.0, 3.0, 0.5, prando),
      };
    },
    [explosionTimeSeconds, radius]
  );

  const group = useRef<Group>();

  const nodes = useMemo(() => {
    const prando = new Prando(seed);
    const outerWaveCount = Math.floor(
      variateNormal(0.0, 1.0, 0.1, prando) * 10
    );
    const innerWaveCount = Math.floor(
      variateNormal(0.0, 1.0, 0.1, prando) * 10
    );
    const nodes: NodeParams[] = [];
    for (let i = 0; i < outerWaveCount; i++) {
      const node = genNode(
        radius / 1.5,
        0.04,
        0.5 * explosionTimeSeconds,
        prando,
        outerWaveCount,
        i,
        1
      );
      nodes.push(node);
    }
    for (let i = 0; i < innerWaveCount; i++) {
      const node = genNode(radius / 2, 0.02, 0, prando, outerWaveCount, i, 2);
      nodes.push(node);
    }

    return nodes;
  }, [seed, radius, explosionTimeSeconds, genNode]);

  const initialProgresses = useMemo(
    () =>
      nodes.map((n) => n.initialProgressNormalized + globalProgressNormalized),
    [globalProgressNormalized, nodes]
  );
  const [progresses, setProgresses] = useState(initialProgresses);

  useFrame((_state, deltaSeconds) => {
    if (autoPlay) {
      if (group.current) {
        group.current.userData.secondsPassed =
          group.current.userData.secondsPassed || 0;
        if (group.current.userData.secondsPassed > explosionTimeSeconds) {
          if (!playOnce) {
            setProgresses(_.clone(initialProgresses));
            group.current.userData.secondsPassed = 0;
          } else {
            // make sure no node is stuck in incomplete mode
            setProgresses(_.times(nodes.length, () => 1.1));
          }
        } else {
          group.current.userData.secondsPassed += deltaSeconds;
          const adjustedProgresses = _.clone(progresses);
          const diff = deltaSeconds / explosionTimeSeconds;
          for (let i = 0; i < adjustedProgresses.length; i++) {
            if (!nodes[i] || !adjustedProgresses[i]) {
              continue;
            }
            adjustedProgresses[i] += diff * nodes[i].progressSpeedMultiplier;
          }

          setProgresses(adjustedProgresses);
        }
      }
    }
  });

  if (globalProgressNormalized >= 1.0) {
    return null;
  }
  return (
    <group position={position} ref={group}>
      {nodes.map((node, i) => {
        return (
          <ThreeExplosionNode
            key={node.id}
            initialSize={node.initialSize}
            scaleSpeed={node.scaleSpeed}
            position={node.position}
            progressNormalized={progresses[i]}
          />
        );
      })}
    </group>
  );
};

export const explosionSfx = [
  'sfx/Explosion3.mp3',
  'sfx/Explosion6.mp3',
  'sfx/Explosion8.mp3',
  'sfx/Explosion9.mp3',
];

export const genExplosionSfxPath = (seed: string) => {
  const prando = new Prando(seed);
  const i = prando.nextInt(0, explosionSfx.length - 1);
  return explosionSfx[i];
};
