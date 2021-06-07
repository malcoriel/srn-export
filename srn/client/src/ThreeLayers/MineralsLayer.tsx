import { InteractorActionType } from './blocks/ThreeInteractor';
import { actionsActive } from '../utils/ShipControls';
import { NatSpawnMineral, ShipAction, ShipActionType } from '../world';
import NetState from '../NetState';
import {
  LongActionStartBuilder,
  Rarity,
  ShootTargetBuilder,
} from '../../../world/pkg/world.extra';
import React from 'react';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { posToThreePos } from './ThreeLayer';
import { mineralHintContent } from '../HtmlLayers/HintWindow';
import { common, rare, uncommon } from '../utils/palette';
import { UnreachableCaseError } from 'ts-essentials';
import { InteractorMap } from './InteractorMap';

export const mineralActionsMap = new Map([
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
            target: ShootTargetBuilder.ShootTargetMineral({ id: objectId }),
          })
        );
      }
    },
  ],
]);

export const rarityToColor = (rarity: Rarity): string => {
  switch (rarity) {
    case Rarity.Unknown:
      return 'white';
    case Rarity.Common:
      return common;
    case Rarity.Uncommon:
      return uncommon;
    case Rarity.Rare:
      return rare;
    default:
      throw new UnreachableCaseError(rarity);
  }
};

interface MineralsLayerParams {
  minerals: NatSpawnMineral[];
}

export const MineralsLayer: React.FC<MineralsLayerParams> = ({ minerals }) => (
  <>
    {minerals.map((m) => {
      return (
        <ThreeFloatingObject
          gid={m.id}
          key={m.id}
          scale={0.2}
          radius={m.radius}
          position={posToThreePos(m.x, m.y)}
          colors={[rarityToColor(m.rarity)]}
          modelName="asteroid.glb"
          interactor={InteractorMap.mineral(m)}
        />
      );
    })}
  </>
);
