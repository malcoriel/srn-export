import React from 'react';
import { findMyPlayer, findMyShip, VisualState } from '../NetState';
import { GameState } from '../../../world/pkg';
import { Line } from '@react-three/drei';
import { liftThreePos, vecToThreePos } from './ThreeLayer';
import Vector from '../utils/Vector';
import { CargoDeliveryQuestState, findPlanet } from '../world';
import { degToRad, size } from '../coord';
import { teal, yellow } from '../utils/palette';
import { ThreeLine } from './blocks/ThreeLine';
import { Vector2 } from 'three';

export const ThreeQuestDirection: React.FC<{
  state: GameState;
  visualState: VisualState;
}> = ({ visualState, state }) => {
  if (!visualState.boundCameraMovement) return null;
  const myPlayer = findMyPlayer(state);
  const myShip = findMyShip(state);
  if (!myShip || !myPlayer) return null;
  const shipPos = Vector.fromIVector(myShip);
  const quest = myPlayer?.quest;
  if (!quest) return null;
  const targetId =
    quest.state === CargoDeliveryQuestState.Picked
      ? quest.to_id
      : quest.from_id;
  const questTarget = targetId ? findPlanet(state, targetId) : undefined;
  if (!questTarget) return null;
  const targetPos = Vector.fromIVector(questTarget);
  if (targetPos.euDistTo(shipPos) < 20) {
    return null;
  }
  const normalized = targetPos.subtract(shipPos).normalize();
  const pointerPos = shipPos.add(normalized.scale(10));
  const leftArrowSide = normalized
    .scale(-1)
    .turnCounterClockwise(degToRad(60))
    .scale(2);
  const rightArrowSide = normalized
    .scale(-1)
    .turnCounterClockwise(degToRad(-60))
    .scale(2);
  const arrowPoints = [
    pointerPos.add(leftArrowSide),
    pointerPos,
    pointerPos.add(rightArrowSide),
  ];
  const smallPointerPos = shipPos.add(normalized.scale(8));
  const smallArrowPoints = [
    smallPointerPos.add(leftArrowSide.scale(0.7)),
    smallPointerPos,
    smallPointerPos.add(rightArrowSide.scale(0.7)),
  ];

  const mediumPointerPos = shipPos.add(normalized.scale(9));
  const mediumArrowPoints = [
    mediumPointerPos.add(leftArrowSide.scale(0.85)),
    mediumPointerPos,
    mediumPointerPos.add(rightArrowSide.scale(0.85)),
  ];

  const arrowActiveIndex = Math.floor(state.milliseconds_remaining / 500) % 3;

  const lineShaderResolutionVec = new Vector2(
    size.width_px / visualState.zoomShift,
    size.height_px / visualState.zoomShift
  );
  return (
    <>
      <ThreeLine
        points={arrowPoints.map(vecToThreePos).map(liftThreePos(50))}
        color={arrowActiveIndex === 0 ? teal : yellow}
        lineWidth={2}
        resolution={lineShaderResolutionVec}
      />
      <ThreeLine
        resolution={lineShaderResolutionVec}
        points={mediumArrowPoints.map(vecToThreePos).map(liftThreePos(50))}
        color={arrowActiveIndex === 1 ? teal : yellow}
        lineWidth={2}
      />
      <ThreeLine
        resolution={lineShaderResolutionVec}
        points={smallArrowPoints.map(vecToThreePos).map(liftThreePos(50))}
        color={arrowActiveIndex === 2 ? teal : yellow}
        lineWidth={2}
      />
    </>
  );
};
