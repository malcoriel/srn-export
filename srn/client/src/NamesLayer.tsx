import React from 'react';
import { antiScale, GameState, scaleConfig } from './world';
import { VisualState } from './NetState';
import { Layer, Text } from 'react-konva';
import Vector, { IVector } from './Vector';

function extractNamePositions(
  state: GameState,
  cameraPosition: IVector
): Array<[string, string, IVector, number]> {
  const res = [];
  const cameraShift = Vector.fromIVector(cameraPosition);
  const shiftPos = (objPos: IVector) => {
    const pos = Vector.fromIVector(objPos);
    return pos.subtract(cameraShift);
  };
  for (const planet of state.planets) {
    let planetProps: [string, string, IVector, number] = [
      planet.id,
      planet.name,
      shiftPos({ x: planet.x, y: planet.y }),
      planet.radius,
    ];
    res.push(planetProps);
  }
  return res;
}

export const NamesLayer: React.FC<{
  state: GameState;
  visualState: VisualState;
}> = ({ state, visualState }) => {
  const names = extractNamePositions(state, visualState.cameraPosition);
  return (
    <Layer>
      {names.map(([id, name, position, radius]) => {
        return (
          <Text
            key={id}
            text={name}
            position={position}
            fill="white"
            align="center"
            offsetY={scaleConfig.scaleX * radius + 20}
            width={200}
            offsetX={100}
            {...antiScale}
          />
        );
      })}
    </Layer>
  );
};
