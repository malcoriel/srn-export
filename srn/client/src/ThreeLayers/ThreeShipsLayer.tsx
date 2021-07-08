import React from 'react';
import _ from 'lodash';
import { findContainer, findMineral, GameState } from '../world';
import { ThreeShip } from './ThreeShip';
import { Ship } from '../world';
import Vector from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import { NetStateIndexes } from '../NetState';
import { LongActionDock } from '../../../world/pkg';

const interpolate = (from: number, to: number, percentage: number): number => {
  let res = (to - from) * percentage + from;
  //console.log(from, to, res);
  return res;
};

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
  indexes: NetStateIndexes;
}> = ({ visMap, state, indexes }) => {
  if (!state) return null;
  const { ships, planets } = state.locations[0];

  const planetsById = _.keyBy(planets, 'id');

  return (
    <group>
      {ships.map((s: Ship, i: number) => {
        if (s.docked_at) return null;
        let tractorTargetPosition;
        if (s.tractor_target) {
          const min = findMineral(state, s.tractor_target);
          const cont = findContainer(state, s.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          } else if (cont) {
            tractorTargetPosition = Vector.fromIVector(cont.position);
          }
        }

        const shipPos = {
          x: s.x,
          y: s.y,
        };
        const player = indexes.playersByShipId.get(s.id);

        let dockingLongAction;
        if (player) {
          dockingLongAction = player.long_actions.find(
            (a) => a.tag === 'Dock'
          ) as LongActionDock;
        }

        if (s.docked_at) {
          const dockPlanet = planetsById[s.docked_at];
          if (dockPlanet) {
            shipPos.x = dockPlanet.x;
            shipPos.y = dockPlanet.y;
          }
        } else if (dockingLongAction) {
          const pct = dockingLongAction.percentage / 100;
          shipPos.x = interpolate(
            dockingLongAction.start_pos.x,
            dockingLongAction.end_pos.x,
            pct
          );
          shipPos.y = interpolate(
            dockingLongAction.start_pos.y,
            dockingLongAction.end_pos.y,
            pct
          );
        }
        let opacity = dockingLongAction
          ? 1 - dockingLongAction.percentage / 100
          : 1.0;
        if (s.docked_at) {
          opacity = 0.0;
        }
        return (
          <ThreeShip
            gid={s.id}
            radius={s.radius}
            visible={visMap[s.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={s.id + i}
            position={Vector.fromIVector(s)}
            rotation={s.rotation}
            color={s.color}
            opacity={opacity}
            interactor={InteractorMap.ship(s)}
          />
        );
      })}
    </group>
  );
};
