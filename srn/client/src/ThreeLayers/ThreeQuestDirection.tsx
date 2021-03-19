import React from 'react';
import { findMyPlayer, findMyShip, VisualState } from '../NetState';
import { GameState } from '../../../world/pkg';
import { Line } from '@react-three/drei';
import { vecToThreePos } from './ThreeLayer';
import Vector from '../utils/Vector';
import { CargoDeliveryQuestState, findPlanet } from '../world';
import { degToRad } from '../coord';
import { yellow } from '../utils/palette';
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
  let targetPos = Vector.fromIVector(questTarget);
  targetPos = new Vector(100, 100);
  const normalized = targetPos.subtract(shipPos).normalize();
  const pointerPos = shipPos.add(normalized.scale(10));
  const leftPoint = pointerPos.add(
    normalized.scale(-1).turnCounterClockwise(degToRad(45)).scale(2)
  );
  const rightPoint = pointerPos.add(
    normalized.scale(-1).turnCounterClockwise(degToRad(-45)).scale(2)
  );

  const arrowPoints = [leftPoint, pointerPos, rightPoint];
  //console.log(arrowPoints.map((v) => v.toFix()));

  return (
    <>
      <Line
        flatShading={false}
        points={[leftPoint, pointerPos].map(vecToThreePos)}
        color={yellow}
        lineWidth={5}
      />
      <Line
        flatShading={false}
        points={[rightPoint, pointerPos].map(vecToThreePos)}
        color={yellow}
        lineWidth={5}
      />
    </>
  );
};
