import React from 'react';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { InteractorActionType } from './blocks/ThreeInteractor';
import { Container } from '../../../world/pkg';
import { actionsActive } from '../utils/ShipControls';
import NetState from '../NetState';
import {
  LongActionStartBuilder,
  ShipActionRustBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import { InteractorMap } from './InteractorMap';
import { posToThreePos } from './util';

export const containerActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      actionsActive.Tractor = ShipActionRustBuilder.ShipActionRustTractor({
        target: objectId,
      });
    },
  ],
  [
    InteractorActionType.Shoot,
    (objectId: string) => {
      const ns = NetState.get();
      if (ns) {
        ns.startLongAction(
          LongActionStartBuilder.LongActionStartShoot({
            target: ShootTargetBuilder.ShootTargetContainer({ id: objectId }),
          })
        );
      }
    },
  ],
]);

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
