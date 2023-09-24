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
import {
  ClientStateIndexes,
  findObjectPositionById,
  findProperty,
} from '../ClientStateIndexing';
import { ObjectPropertyKey } from '../../../world/pkg/world.extra';
import { ObjectPropertyDecays } from '../../../world/pkg/world';

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
            radius={ship.spatial.radius * (opacity / 2 + 0.5)}
            visible={visMap[ship.id]}
            tractorTargetPosition={tractorTargetPosition}
            key={ship.id + i}
            position={Vector.fromIVector(ship.spatial.position)}
            rotation={ship.spatial.rotation_rad}
            color={ship.color}
            opacity={opacity}
            markers={ship.markers}
            velocity={ship.spatial.velocity}
            interactor={
              ship.id === myShipId
                ? InteractorMap.myShip(ship)
                : InteractorMap.ship(ship)
            }
            hpNormalized={ship.health.current / ship.health.max}
            longActions={mapLongActions(ship.long_actions)}
            findObjectPositionByIdBound={(id) => {
              return findObjectPositionById(state, id);
            }}
            turrets={ship.turrets}
            brake={
              ship.acceleration_markers
                ? ship.acceleration_markers.brake > 0.0 ||
                  ship.acceleration_markers.gas < 0.0
                : false
            }
            gas={
              ship.acceleration_markers
                ? ship.acceleration_markers.gas > 0.0
                : false
            }
            turn={
              ship.acceleration_markers ? ship.acceleration_markers.turn : 0.0
            }
          />
        );
      })}
      {wrecks.map((w) => {
        const decayProp = findProperty<ObjectPropertyDecays>(
          w.properties,
          ObjectPropertyKey.Decays
        );
        return (
          <ThreeShipWreck
            key={w.id}
            color={w.color}
            gid={w.id}
            // only considers max ticks to prevent accidental update, even if it means a bit of desync
            fadeOver={decayProp ? decayProp.fields.max_ticks : undefined}
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
