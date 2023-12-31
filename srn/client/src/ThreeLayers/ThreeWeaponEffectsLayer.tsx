import React from 'react';
import NetState from '../NetState';
import { LongAction, Player } from '../../../world/pkg';
import Vector from '../utils/Vector';
import { indexShipsByPlayerId } from '../world';
import { ThreeLaserBeam } from './combat/ThreeLaserBeam';
import { findObjectPositionById } from '../ClientStateIndexing';

// type BeamProps = {
//   playerId: string;
//   start: Vector;
//   end: Vector;
//   progression: number;
// };

export const ThreeWeaponEffectsLayer = () => {
  const ns = NetState.get();
  if (!ns) {
    return null;
  }
  // const { state } = ns;
  // const shipsByPlayer = indexShipsByPlayerId(state.locations[0], state.players);
  // const beams: BeamProps[] = ns.state.players.reduce((acc, curr: Player) => {
  //   const ship = shipsByPlayer[curr.id];
  //   if (!ship) {
  //     return acc;
  //   }
  //   const shoots = ship.long_actions
  //     .map((shootLongAct: LongAction) => {
  //       if (shootLongAct.tag !== 'Shoot') {
  //         return null;
  //       }
  //
  //       if (shootLongAct.target.tag === 'Unknown') {
  //         return null;
  //       }
  //
  //       const end = findObjectPositionById(state, shootLongAct.target.id);
  //       if (!end) {
  //         return null;
  //       }
  //       return {
  //         start: Vector.fromIVector(ship),
  //         end,
  //         progression: shootLongAct.percentage,
  //         playerId: curr.id,
  //       };
  //     })
  //     .filter((s) => !!s) as BeamProps[];
  //   acc.push(...shoots);
  //   return acc;
  // }, [] as BeamProps[]);
  return (
    <>
      {/*{beams.map((bp) => (*/}
      {/*  <ThreeLaserBeam*/}
      {/*    key={bp.playerId}*/}
      {/*    start={bp.start}*/}
      {/*    end={bp.end}*/}
      {/*    progression={bp.progression}*/}
      {/*    width={0.2}*/}
      {/*    color="red"*/}
      {/*  />*/}
      {/*))}*/}
    </>
  );
};
