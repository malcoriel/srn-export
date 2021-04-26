import React, { useMemo } from 'react';
import { Circle, Layer, Rect } from 'react-konva';
import _ from 'lodash';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import Vector from '../utils/Vector';
import { babyBlue } from '../utils/palette';
import { Planet, Ship } from '../world';
import {
  calcRealPosToScreenPos,
  size,
  unitsToPixels_min,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../coord';

const MAX_ITER = 100;
const TRAJECTORY_STEP = 10.0;

const buildTrajectory = (questTarget: Planet, myShip: Ship): Vector[] => {
  let current = Vector.fromIVector(myShip);
  const res: Vector[] = [];
  let iter = 0;
  const dir1 = Vector.fromIVector(questTarget).subtract(
    Vector.fromIVector(myShip)
  );
  const dir = dir1.normalize().scale(TRAJECTORY_STEP);
  while (
    Vector.fromIVector(current).euDistTo(Vector.fromIVector(questTarget)) >
    TRAJECTORY_STEP
  ) {
    current = current.add(dir);
    res.push(current);
    if (iter++ > MAX_ITER) {
      break;
    }
  }
  return res;
};

export const MyTrajectoryLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('MyTrajectoryLayer', true);
  const { state, visualState } = ns;
  const myShip = findMyShip(state);

  const { shiftPos } = useMemo(() => {
    const shiftPos = calcRealPosToScreenPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift
    );
    return { shiftPos };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualState.cameraPosition, visualState.zoomShift, size]);

  if (!myShip) return null;

  const zoomProp = visualState.zoomShift || 1.0;

  const planetsById = _.keyBy(state.locations[0].planets, 'id');
  const pointTarget = myShip.navigate_target;
  const planetTarget = myShip.dock_target
    ? planetsById[myShip.dock_target]
    : undefined;
  const wrapOffset = 10;

  return (
    <Layer>
      {myShip.trajectory.map((position, i) => {
        return (
          <Circle
            radius={3}
            key={i}
            position={shiftPos(position)}
            fill={babyBlue}
          />
        );
      })}
      {pointTarget && (
        <Circle position={shiftPos(pointTarget)} radius={5} fill={babyBlue} />
      )}
      {planetTarget && (
        <Rect
          width={
            (planetTarget.radius * unitsToPixels_min() * zoomProp +
              wrapOffset) *
            2
          }
          height={
            (planetTarget.radius * unitsToPixels_min() * zoomProp +
              wrapOffset) *
            2
          }
          position={shiftPos(planetTarget).subtract(
            new Vector(
              planetTarget.radius * unitsToPixels_min() * zoomProp + wrapOffset,
              planetTarget.radius * unitsToPixels_min() * zoomProp + wrapOffset
            )
          )}
          stroke={babyBlue}
          strokeWidth={1.01}
          dashEnabled
          dash={[0.5]}
        />
      )}
    </Layer>
  );
};
