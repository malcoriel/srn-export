import React, { useMemo, useRef, useState } from 'react';
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
  progressNormalized: number;
  explosionTimeFrames: number;
  position?: Vector3Arr;
  radius?: number;
};
type NodeParams = {
  id: string;
  initialSize: number;
  scaleSpeed: number;
  initialProgressNormalized: number;
  desiredMaxScale: number;
  explosionTimeFrames: number;
  position: Vector3Arr;
};

export const ThreeExplosion: React.FC<ThreeExplosionProps> = ({
  seed,
  position,
  radius = 40,
  explosionTimeFrames = 240,
  progressNormalized: globalProgressNormalized,
  autoPlay,
}) => {
  const genNode = (
    maxDist: number,
    maxSize: number,
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

    const desiredMaxScale = variateNormal(3.0, 6.0, 1.0, prando);
    const initialSize = variateNormal(1.0, maxSize, 0.5, prando);
    const scaleSpeed = variateNormal(1.02, 1.08, 0.1, prando);

    // scale is exponential with scaleSpeed as exponent base
    // scale = scaleSpeed ** (explosionTimeFrames * progressNormalized)
    // so maxScale = scaleSpeed ** (explosionTimeFrames * 1.0)
    // so the time to reach max scale should be
    // log(maxScale) base scaleSpeed

    const explosionTimeFrames =
      Math.log(desiredMaxScale) / Math.log(scaleSpeed);
    const desiredDelayFrames =
      minDelay + Math.max(0, variateNormal(-60, 20, 10, prando));
    const progressShift = -desiredDelayFrames / explosionTimeFrames;

    return {
      id: `${wave}_${i}`,
      initialSize,
      position: [x, y, 0],
      scaleSpeed,
      desiredMaxScale,
      initialProgressNormalized: progressShift,
      explosionTimeFrames,
    };
  };

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
        radius,
        radius / 10,
        10,
        prando,
        outerWaveCount,
        i,
        1
      );
      nodes.push(node);
    }
    for (let i = 0; i < innerWaveCount; i++) {
      const node = genNode(
        radius / 2,
        radius / 20,
        0,
        prando,
        outerWaveCount,
        i,
        2
      );
      nodes.push(node);
    }

    return nodes;
  }, [seed, radius]);

  const initialProgresses = useMemo(
    () =>
      nodes.map((n) => n.initialProgressNormalized + globalProgressNormalized),
    [globalProgressNormalized, nodes]
  );
  const [progresses, setProgresses] = useState(initialProgresses);

  useFrame(() => {
    if (autoPlay) {
      if (group.current) {
        group.current.userData.framesPassed =
          group.current.userData.framesPassed || 0;
        if (group.current.userData.framesPassed > explosionTimeFrames) {
          setProgresses(_.clone(initialProgresses));
          group.current.userData.framesPassed = 0;
        } else {
          group.current.userData.framesPassed += 1;
          const adjustedProgresses = _.clone(progresses);
          for (let i = 0; i < adjustedProgresses.length; i++) {
            adjustedProgresses[i] +=
              group.current.userData.framesPassed / 60 / explosionTimeFrames;
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
            explosionTimeFrames={node.explosionTimeFrames}
            progressNormalized={progresses[i] * (60 / node.explosionTimeFrames)}
          />
        );
      })}
    </group>
  );
};
