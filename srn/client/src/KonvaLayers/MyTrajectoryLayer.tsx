import React, { useMemo } from 'react';
import { Circle, Layer, Rect } from 'react-konva';
import _ from 'lodash';
import NetState, {
  findMyPlayer,
  findMyShip,
  useNSForceChange,
} from '../NetState';
import Vector from '../utils/Vector';
import { babyBlue, yellow } from '../utils/palette';
import { Planet, QuestState, Ship } from '../world';
import { findPlanet } from '../HtmlLayers/NetworkStatus';
import {
  calcRealPosToScreenPos,
  calcScreenPosToRealPos,
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
  }, [visualState.cameraPosition, visualState.zoomShift, size]);

  if (!myShip) return null;

  const zoomProp = visualState.zoomShift || 1.0;

  const planetsById = _.keyBy(state.planets, 'id');
  const pointTarget = myShip.navigate_target;
  const planetTarget = myShip.dock_target
    ? planetsById[myShip.dock_target]
    : undefined;
  const wrapOffset = 10;

  const myPlayer = findMyPlayer(state);

  const quest = myPlayer && myPlayer.quest;
  let questTarget: Planet | undefined;
  let questTargetTrajectory: Vector[] | undefined;
  if (quest) {
    if (quest.state == QuestState.Started) {
      questTarget = findPlanet(state, quest.from_id);
    } else if (quest.state == QuestState.Picked) {
      questTarget = findPlanet(state, quest.to_id);
    }
  }
  if (questTarget) {
    questTargetTrajectory = buildTrajectory(questTarget, myShip);
  }

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
      {questTargetTrajectory &&
        questTargetTrajectory.map((position, i) => {
          return (
            <Rect
              width={5}
              height={5}
              key={i}
              text={name}
              position={shiftPos(position)}
              fill={yellow}
            />
          );
        })}
      {questTarget && (
        <Circle position={shiftPos(questTarget)} radius={5} fill={yellow} />
      )}
    </Layer>
  );
};
