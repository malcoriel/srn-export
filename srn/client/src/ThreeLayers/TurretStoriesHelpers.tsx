import { LongActionBuilder } from '../../../world/pkg/world.extra';
import { VectorF } from '../utils/Vector';
import { cycle } from '../utils/cycle';
import { UnreachableCaseError } from 'ts-essentials';
import _ from 'lodash';

export enum ShootMode {
  Simultaneous,
  PartialSimultaneous,
  Alternating,
}

export const shootTargets = {
  top: VectorF(0.0, 5),
  right: VectorF(5, 0.0),
  bottomRight: VectorF(6, -4),
  topRight: VectorF(6, 4),
  topLeft: VectorF(-6, 4),
};
const genLongAct = (percentage: number, turretId: number) => {
  const longActionShoot = LongActionBuilder.LongActionShoot({
    id: '1',
    micro_left: 500,
    percentage,
    target: { tag: 'Ship', id: '1' },
    turret_id: turretId,
  });
  longActionShoot.turret_id = turretId;
  return longActionShoot;
};
export const genLongActions = (shootMode: ShootMode, percentage: number) => {
  switch (shootMode) {
    case ShootMode.Alternating:
      return [
        genLongAct(cycle(percentage + 50, 0, 100), 1),
        genLongAct(cycle(percentage + 17, 0, 100), 2),
        genLongAct(percentage, 3),
        genLongAct(cycle(percentage + 66, 0, 100), 4),
      ];
    case ShootMode.PartialSimultaneous:
      return [genLongAct(percentage, 1), genLongAct(percentage, 3)];
    case ShootMode.Simultaneous:
      return [
        genLongAct(percentage, 1),
        genLongAct(percentage, 2),
        genLongAct(percentage, 3),
        genLongAct(percentage, 4),
      ];
    default:
      throw new UnreachableCaseError(shootMode);
  }
};

export function genTurrets(count: number) {
  return _.times(count, (i) => ({ id: i + 1 }));
}
