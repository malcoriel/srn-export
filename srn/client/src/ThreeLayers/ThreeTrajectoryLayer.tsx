import React from 'react';
import { babyBlue } from '../utils/palette';
import { posToThreePos } from './util';
import { ClientStateIndexes } from '../ClientStateIndexing';
import { SHIP_FIXED_Z } from './ShipShape';
import { ThreeTrajectory } from './ThreeTrajectory';
import { ThreeTrajectoryItemProps } from './ThreeTrajectoryItem';
import Vector, { VectorFzero } from '../utils/Vector';

export const ThreeTrajectoryLayer: React.FC<{
  indexes: ClientStateIndexes;
}> = ({ indexes }) => {
  if (indexes.myShip) {
    const { myShip, planetsById } = indexes;
    const pointTarget = myShip.navigate_target;
    const planetTarget = myShip.dock_target
      ? planetsById.get(myShip.dock_target)
      : undefined;
    const trajectory_v2 =
      myShip.trajectory_v2.tag === 'Success'
        ? myShip.trajectory_v2.fields.points
        : null;
    // const myShipAccMax =
    //   myShip.movement_definition.tag === 'ShipAccelerated'
    //     ? myShip.movement_definition.acc_linear
    //     : 1.0;
    // const myShipVelMax =
    //   myShip.movement_definition.tag === 'ShipAccelerated'
    //     ? myShip.movement_definition.max_linear_speed
    //     : 1.0;
    return (
      <>
        {!trajectory_v2 &&
          myShip.trajectory.map((position, i) => {
            return (
              <mesh
                key={i}
                position={posToThreePos(position.x, position.y, SHIP_FIXED_Z)}
              >
                <circleBufferGeometry args={[0.25, 8]} />
                <meshBasicMaterial color={babyBlue} />
              </mesh>
            );
          })}
        {pointTarget && (
          <mesh
            position={posToThreePos(pointTarget.x, pointTarget.y, SHIP_FIXED_Z)}
          >
            <circleBufferGeometry args={[0.5, 8]} />
            <meshBasicMaterial color={babyBlue} />
          </mesh>
        )}
        {trajectory_v2 && (
          <ThreeTrajectory
            items={trajectory_v2.map((item) => {
              const res: ThreeTrajectoryItemProps = {
                accNormalized: VectorFzero,
                position: item.spatial.position,
                velocityNormalized: Vector.fromIVector(
                  item.spatial.velocity
                ).normalize(),
              };
              return res;
            })}
          />
        )}
        {pointTarget && (
          <mesh
            position={posToThreePos(pointTarget.x, pointTarget.y, SHIP_FIXED_Z)}
          >
            <circleBufferGeometry args={[0.5, 8]} />
            <meshBasicMaterial color={babyBlue} />
          </mesh>
        )}
        {planetTarget && (
          <mesh
            position={posToThreePos(
              planetTarget.spatial.position.x,
              planetTarget.spatial.position.y,
              SHIP_FIXED_Z
            )}
          >
            <ringGeometry
              args={[
                planetTarget.spatial.radius + 0.5,
                planetTarget.spatial.radius + 0.5 + 0.25,
                Math.max(16, planetTarget.spatial.radius * 3),
              ]}
            />
            <meshBasicMaterial color={babyBlue} />
          </mesh>
        )}
      </>
    );
  }
  return null;
};
