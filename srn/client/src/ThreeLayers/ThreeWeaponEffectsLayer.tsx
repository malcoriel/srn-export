// @ts-ignore
import React from 'react';
// @ts-ignore
import NetState from '../NetState';
import { LongAction, LongActionShoot, Player } from '../../../world/pkg';
import Vector from '../utils/Vector';
import {
  findObjectById,
  findObjectPositionById,
  indexShipsByPlayerId,
} from '../world';
import { ThreeLaserBeam } from './combat/ThreeLaserBeam';

type BeamProps = {
  playerId: string;
  start: Vector;
  end: Vector;
  progression: number;
};
export const ThreeWeaponEffectsLayer = () => {
  const ns = NetState.get();
  if (!ns) {
    return null;
  }
  const { state } = ns;
  const shipsByPlayer = indexShipsByPlayerId(state.locations[0], state.players);
  const beams: BeamProps[] = ns.state.players.reduce((acc, curr: Player) => {
    const ship = shipsByPlayer[curr.id];
    if (!ship) {
      return acc;
    }
    const shoots = curr.long_actions
      .map((shootLongAct: LongAction) => {
        if (shootLongAct.tag !== 'Shoot') {
          return null;
        }

        if (shootLongAct.target.tag === 'Unknown') {
          return null;
        }

        const end = findObjectPositionById(state, shootLongAct.target.id);
        if (!end) {
          return null;
        }
        return {
          start: Vector.fromIVector(ship),
          end,
          progression: shootLongAct.percentage,
          playerId: curr.id,
        };
      })
      .filter((s) => !!s) as BeamProps[];
    acc.push(...shoots);
    return acc;
  }, [] as BeamProps[]);
  return (
    <>
      {beams.map((bp) => (
        <ThreeLaserBeam
          key={bp.playerId}
          start={bp.start}
          end={bp.end}
          progression={bp.progression}
        />
      ))}
    </>
  );
};
