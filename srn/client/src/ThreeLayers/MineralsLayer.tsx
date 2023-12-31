import { NatSpawnMineral } from '../world';
import { Rarity } from '../../../world/pkg/world.extra';
import React from 'react';
import { ThreeFloatingObject } from './ThreeFloatingObject';
import { common, rare, uncommon } from '../utils/palette';
import { UnreachableCaseError } from 'ts-essentials';
import { InteractorMap } from './InteractorMap';
import _ from 'lodash';
import { posToThreePos } from './util';

export const rarityToColor = _.memoize((rarity: Rarity): string => {
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
});

export const rarityToColorArr = _.memoize((rarity: Rarity) => [
  rarityToColor(rarity),
]);

interface MineralsLayerParams {
  minerals: NatSpawnMineral[];
}
export const MineralsLayer: React.FC<MineralsLayerParams> = ({ minerals }) => {
  return (
    <>
      {minerals.map((m) => {
        return (
          <ThreeFloatingObject
            gid={m.id}
            key={m.id}
            scale={0.2}
            radius={m.radius}
            position={posToThreePos(m.x, m.y)}
            colors={rarityToColorArr(m.rarity)}
            modelName="asteroid.glb"
            interactor={InteractorMap.mineral(m)}
          />
        );
      })}
    </>
  );
};
