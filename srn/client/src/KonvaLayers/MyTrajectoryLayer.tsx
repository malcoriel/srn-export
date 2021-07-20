import React, { useMemo } from 'react';
import { Circle, Layer, Rect } from 'react-konva';
import _ from 'lodash';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import Vector from '../utils/Vector';
import { babyBlue } from '../utils/palette';
import {
  calcRealPosToScreenPos,
  size,
  unitsToPixels_min,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../coord';

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
