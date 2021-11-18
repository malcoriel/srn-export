import React, { useMemo } from 'react';
import { ThreeExplosionNode } from './ThreeExplosionNode';
import Prando from 'prando';
import { variateNormal } from '../shaders/randUtils';
import { Vector3Arr } from '../util';

export type ThreeExplosionProps = {
  seed: string;
  position?: Vector3Arr;
  radius?: number;
};
type NodeParams = {
  id: string;
  delay: number;
  maxScale: number;
  initialSize: number;
  scaleSpeed: number;
  position: Vector3Arr;
};

export const ThreeExplosion: React.FC<ThreeExplosionProps> = ({
  seed,
  position,
  radius = 40,
}) => {
  function genNode(
    maxDist: number,
    maxSize: number,
    minDelay: number,
    prando: Prando,
    count: number,
    i: number,
    wave: number
  ) {
    const r = variateNormal(0, maxDist, 5, prando);
    const theta =
      ((2 * Math.PI) / count) * (i + variateNormal(-1.0, 1.0, 0.5, prando));
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);

    const node: NodeParams = {
      delay: minDelay + Math.max(0, variateNormal(-20, 60, 5, prando)),
      id: `${wave}_${i}`,
      initialSize: variateNormal(1.0, maxSize, 0.5, prando),
      maxScale: variateNormal(3.0, 6.0, 1.0, prando),
      position: [x, y, 0],
      scaleSpeed: 1.1,
    };
    return node;
  }

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
  return (
    <group position={position}>
      {nodes.map((node) => {
        return (
          <ThreeExplosionNode
            key={node.id}
            delay={node.delay}
            maxScale={node.maxScale}
            initialSize={node.initialSize}
            scaleSpeed={node.scaleSpeed}
            position={node.position}
          />
        );
      })}
    </group>
  );
};
