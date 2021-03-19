import React from 'react';
import { findMyPlayer, findMyShip, VisualState } from '../NetState';
import { GameState } from '../../../world/pkg';
import { Line } from '@react-three/drei';
import { vecToThreePos } from './ThreeLayer';
import Vector from '../utils/Vector';
import { CargoDeliveryQuestState, findPlanet } from '../world';
import { degToRad } from '../coord';
import { yellow } from '../utils/palette';

const liftThreePos = (zShift: number) => (
  threeArrVec: [number, number, number]
): [number, number, number] => [
  threeArrVec[0],
  threeArrVec[1],
  threeArrVec[2] + zShift,
];

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

  return (
    <>
      <Line
        flatShading={false}
        points={arrowPoints.map(vecToThreePos).map(liftThreePos(50))}
        color={yellow}
        lineWidth={2}
      />
      <Line
        flatShading={false}
        points={smallArrowPoints.map(vecToThreePos).map(liftThreePos(50))}
        color={yellow}
        lineWidth={2}
      />
    </>
  );
};
