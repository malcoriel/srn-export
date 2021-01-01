import React from 'react';
import NetState, { findMyShip } from '../NetState';
import { Circle, Layer, Rect } from 'react-konva';
import Vector from '../utils/Vector';
import _ from 'lodash';
import { babyBlue } from '../utils/palette';
import { antiScale } from '../world';

export const MyTrajectoryLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  const myShip = findMyShip(state);
  if (!myShip) return null;

  let planetsById = _.keyBy(state.planets, 'id');
  let pointTarget = myShip.navigate_target;
  let planetTarget = myShip.dock_target
    ? planetsById[myShip.dock_target]
    : undefined;
  let cameraShift = Vector.fromIVector(visualState.cameraPosition);
  let wrapOffset = 0.5;

  return (
    <Layer>
      {myShip.trajectory.map((position, i) => {
        return (
          <Circle
            radius={0.1}
            key={i}
            text={name}
            position={Vector.fromIVector(position).subtract(cameraShift)}
            fill={babyBlue}
          />
        );
      })}
      {pointTarget && (
        <Circle
          position={Vector.fromIVector(pointTarget).subtract(cameraShift)}
          radius={0.5}
          fill={babyBlue}
        />
      )}
      {planetTarget && (
        <Rect
          width={(planetTarget.radius + wrapOffset) * 2}
          height={(planetTarget.radius + wrapOffset) * 2}
          position={Vector.fromIVector(planetTarget)
            .subtract(cameraShift)
            .subtract(
              new Vector(
                planetTarget.radius + wrapOffset,
                planetTarget.radius + wrapOffset
              )
            )}
          stroke={babyBlue}
          strokeWidth={1.01 * antiScale.line}
          dashEnabled
          dash={[0.5]}
        />
      )}
    </Layer>
  );
};
