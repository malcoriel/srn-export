import React from 'react';
import NetState, { findMyPlayer, findMyShip } from '../NetState';
import { Circle, Layer, Rect } from 'react-konva';
import Vector from '../utils/Vector';
import _ from 'lodash';
import { babyBlue, yellow } from '../utils/palette';
import { antiScale, Planet, QuestState, Ship } from '../world';
import { findPlanet } from '../HtmlLayers/NetworkStatus';

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
  const { state, visualState } = ns;
  const myShip = findMyShip(state);
  if (!myShip) return null;
  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  let planetsById = _.keyBy(state.planets, 'id');
  let pointTarget = myShip.navigate_target;
  let planetTarget = myShip.dock_target
    ? planetsById[myShip.dock_target]
    : undefined;
  let cameraShift = Vector.fromIVector(visualState.cameraPosition);
  let wrapOffset = 0.5;

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
            radius={0.2}
            key={i}
            position={Vector.fromIVector(position)
              .subtract(cameraShift)
              .scale(1 / zoomProp)}
            fill={babyBlue}
          />
        );
      })}
      {pointTarget && (
        <Circle
          position={Vector.fromIVector(pointTarget)
            .subtract(cameraShift)
            .scale(1 / zoomProp)}
          radius={0.5}
          fill={babyBlue}
        />
      )}
      {planetTarget && (
        <Rect
          width={(planetTarget.radius / zoomProp + wrapOffset) * 2}
          height={(planetTarget.radius / zoomProp + wrapOffset) * 2}
          position={Vector.fromIVector(planetTarget)
            .subtract(cameraShift)
            .subtract(
              new Vector(
                planetTarget.radius + wrapOffset,
                planetTarget.radius + wrapOffset
              )
            )
            .scale(1 / zoomProp)}
          stroke={babyBlue}
          strokeWidth={1.01 * antiScale().line}
          dashEnabled
          dash={[0.5]}
        />
      )}
      {questTargetTrajectory &&
        questTargetTrajectory.map((position, i) => {
          return (
            <Rect
              width={0.6}
              height={0.6}
              key={i}
              text={name}
              position={Vector.fromIVector(position)
                .subtract(cameraShift)
                .scale(1 / zoomProp)}
              fill={yellow}
            />
          );
        })}
      {questTarget && (
        <Circle
          position={Vector.fromIVector(questTarget)
            .subtract(cameraShift)
            .scale(1 / zoomProp)}
          radius={0.5}
          fill={yellow}
        />
      )}
    </Layer>
  );
};
