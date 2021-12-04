import React from 'react';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { Container } from '../../../world/pkg';
import { InteractorMap } from './InteractorMap';
import { posToThreePos } from './util';

interface ContainersLayerParams {
  containers: Container[];
}

export const ContainersLayer: React.FC<ContainersLayerParams> = ({
  containers,
}: ContainersLayerParams) => (
  <>
    {containers.map((c) => (
      <ThreeFloatingObject
        gid={c.id}
        key={c.id}
        radius={c.radius}
        position={posToThreePos(c.position.x, c.position.y)}
        modelName="container.glb"
        scale={0.002}
        interactor={InteractorMap.container(c)}
      />
    ))}
  </>
);
