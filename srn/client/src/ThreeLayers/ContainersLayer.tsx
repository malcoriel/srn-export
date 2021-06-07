import React from 'react';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { posToThreePos } from './ThreeLayer';
import { containerHintContent } from '../HtmlLayers/HintWindow';
import { InteractorActionType } from './blocks/ThreeInteractor';
import { rare } from '../utils/palette';
import { Container } from '../../../world/pkg';
import { actionsActive } from '../utils/ShipControls';
import { ShipAction, ShipActionType } from '../world';
import NetState from '../NetState';
import {
  LongActionStartBuilder,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';

const containerActionsMap = new Map([
  [
    InteractorActionType.Tractor,
    (objectId: string) => {
      actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(objectId);
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
        meshes={['0.children.0', '0.children.1', '0.children.2']}
        scale={0.002}
        interactor={{
          hint: containerHintContent(),
          defaultAction: InteractorActionType.Tractor,
          outlineColor: rare,
          actions: containerActionsMap,
        }}
      />
    ))}
  </>
);
