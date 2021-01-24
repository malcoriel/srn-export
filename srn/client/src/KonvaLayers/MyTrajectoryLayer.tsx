import React, { useMemo } from 'react';
import NetState, {
  findMyPlayer,
  findMyShip,
  useNSForceChange,
} from '../NetState';
import { Circle, Layer, Rect } from 'react-konva';
import Vector from '../utils/Vector';
import _ from 'lodash';
import { babyBlue, yellow } from '../utils/palette';
import {
  Planet,
  QuestState,
  Ship,
  size,
  unitsToPixels_min,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../world';
import { findPlanet } from '../HtmlLayers/NetworkStatus';
import { calcRealPosToScreenPos, calcScreenPosToRealPos } from '../coord';

const MAX_ITER = 100;
const TRAJECTORY_STEP = 10.0;

const buildTrajectory = (questTarget: Planet, myShip: Ship): Vector[] => {
  let current = Vector.fromIVector(myShip);
  let res: Vector[] = [];
  let iter = 0;
  let dir1 = Vector.fromIVector(questTarget).subtract(
    Vector.fromIVector(myShip)
  );
  let dir = dir1.normalize().scale(TRAJECTORY_STEP);
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
  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const { shiftPos } = useMemo(() => {
    const shiftPos = calcRealPosToScreenPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels()
    );
    return { shiftPos };
  }, [visualState.cameraPosition, zoomProp, size]);

  if (!myShip) return null;

  let planetsById = _.keyBy(state.planets, 'id');
  let pointTarget = myShip.navigate_target;
  let planetTarget = myShip.dock_target
    ? planetsById[myShip.dock_target]
    : undefined;
  let wrapOffset = 10;

  const myPlayer = findMyPlayer(state);

  const quest = myPlayer && myPlayer.quest;
  let questTarget: Planet | undefined = undefined;
  let questTargetTrajectory: Vector[] | undefined = undefined;
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
        <Circle position={shiftPos(pointTarget)} radius={0.5} fill={babyBlue} />
      )}
      {planetTarget && (
        <Rect
          width={(planetTarget.radius * unitsToPixels_min() + wrapOffset) * 2}
          height={(planetTarget.radius * unitsToPixels_min() + wrapOffset) * 2}
          position={shiftPos(planetTarget).subtract(
            new Vector(
              planetTarget.radius * unitsToPixels_min() + wrapOffset,
              planetTarget.radius * unitsToPixels_min() + wrapOffset
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
        <Circle position={shiftPos(questTarget)} radius={8} fill={yellow} />
      )}
    </Layer>
  );
};
