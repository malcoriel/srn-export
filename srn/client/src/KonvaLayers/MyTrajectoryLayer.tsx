import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { Circle, Layer } from 'react-konva';
import Vector from '../utils/Vector';

export const MyTrajectoryLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  const myShip = findMyShip(state);
  if (!myShip) return null;

  return (
    <Layer>
      {myShip.trajectory.map((position, i) => {
        return (
          <Circle
            radius={0.1}
            key={i}
            text={name}
            position={Vector.fromIVector(position).subtract(
              Vector.fromIVector(visualState.cameraPosition)
            )}
            fill="white"
          />
        );
      })}
    </Layer>
  );
};
