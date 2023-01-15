import React from 'react';
import { findContainer, findMineral, GameState, Ship } from '../world';
import { ThreeShip } from './ThreeShip';
import Vector from '../utils/Vector';
import { InteractorMap } from './InteractorMap';
import {
  LongAction,
  LongActionDock,
  LongActionUndock,
} from '../../../world/pkg';
import { ThreeShipWreck } from './ThreeShipWreck';
import _ from 'lodash';
import {
  ClientStateIndexes,
  findMyShip,
  findObjectPositionById,
} from '../ClientStateIndexing';

// Right now, there's no server-side support for actual separate shooting
// So this mapping is for visual effect only
const mapLongActions = (long_actions: LongAction[]) => {
  return long_actions
    .map((la) => {
      if (la.tag !== 'Shoot') {
        return null;
      }
      return la;
    })
    .filter((la) => !!la)
    .flat() as LongAction[];
};

export const ThreeShipsLayer: React.FC<{
  visMap: Record<string, boolean>;
  state: GameState;
  indexes: ClientStateIndexes;
}> = ({ visMap, state, indexes }) => {
  if (!state) return null;
  const { ships, wrecks } = state.locations[0];

  const myShipId = indexes.myShip?.id;
  return (
    <group>
      {ships.map((ship: Ship, i: number) => {
        if (ship.docked_at) return null;
        let tractorTargetPosition;
        if (ship.tractor_target) {
          const min = findMineral(state, ship.tractor_target);
          const cont = findContainer(state, ship.tractor_target);
          if (min) {
            tractorTargetPosition = Vector.fromIVector(min);
          } else if (cont) {
            tractorTargetPosition = Vector.fromIVector(cont.position);
          }
        }

        const dockingLongAction = ship.long_actions.find(
          (a) => a.tag === 'Dock'
        ) as LongActionDock;
        const undockingLongAction = ship.long_actions.find(
          (a) => a.tag === 'Undock'
        ) as LongActionUndock;
        let opacity: number;
        if (dockingLongAction) {
          opacity = 1 - dockingLongAction.percentage / 100;
        } else if (undockingLongAction) {
          opacity = undockingLongAction.percentage / 100;
        } else {
          opacity = 1.0;
        }
        return (
          <ThreeShip
            gid={ship.id}
            radius={ship.radius * (opacity / 2 + 0.5)}
            visible={visMap[ship.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={ship.id + i}
            position={Vector.fromIVector(ship)}
            rotation={ship.rotation}
            color={ship.color}
            opacity={opacity}
            interactor={
              ship.id === myShipId
                ? InteractorMap.myShip(ship)
                : InteractorMap.ship(ship)
            }
            hpNormalized={ship.health.current / ship.health.max}
            longActions={mapLongActions(ship.long_actions)}
            findObjectPositionByIdBound={(id) => {
              const pos = findObjectPositionById(state, id);
              if (pos) {
                pos.y = -pos.y;
              }
              return pos;
            }}
            turrets={ship.turrets}
          />
        );
      })}
      {wrecks.map((w) => {
        return (
          <ThreeShipWreck
            key={w.id}
            color={w.color}
            gid={w.id}
            opacity={1.0}
            position={Vector.fromIVector(w.spatial.position)}
            radius={w.spatial.radius}
            rotation={w.spatial.rotation_rad}
          />
        );
      })}
    </group>
  );
};
