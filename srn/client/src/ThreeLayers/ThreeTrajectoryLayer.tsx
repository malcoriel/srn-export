import React from 'react';
import { babyBlue } from '../utils/palette';
import { posToThreePos } from './util';
import { ClientStateIndexes } from '../ClientStateIndexing';

export const ThreeTrajectoryLayer: React.FC<{
  indexes: ClientStateIndexes;
}> = ({ indexes }) => {
  if (indexes.myShip) {
    const { myShip, planetsById } = indexes;
    const pointTarget = myShip.navigate_target;
    const planetTarget = myShip.dock_target
      ? planetsById.get(myShip.dock_target)
      : undefined;
    return (
      <>
        {myShip.trajectory.map((position, i) => {
          return (
            <mesh key={i} position={posToThreePos(position.x, position.y)}>
              <circleBufferGeometry args={[0.25, 8]} />
              <meshBasicMaterial color={babyBlue} />
            </mesh>
          );
        })}
        {pointTarget && (
          <mesh position={posToThreePos(pointTarget.x, pointTarget.y)}>
            <circleBufferGeometry args={[0.5, 8]} />
            <meshBasicMaterial color={babyBlue} />
          </mesh>
        )}
        {planetTarget && (
          <mesh position={posToThreePos(planetTarget.x, planetTarget.y)}>
            <ringGeometry
              args={[
                planetTarget.radius + 0.5,
                planetTarget.radius + 0.5 + 0.25,
                Math.max(16, planetTarget.radius * 3),
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
