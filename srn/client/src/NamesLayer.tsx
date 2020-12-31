import React from 'react';
import { antiScale, GameState, scaleConfig } from './world';
import { VisualState } from './NetState';
import { Layer, Text } from 'react-konva';
import Vector, { IVector } from './Vector';
import _ from 'lodash';

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
      shiftPos(planet),
      planet.radius,
    ];
    res.push(planetProps);
  }

  const shipsById = _.keyBy(state.ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    let ship = shipsById[player.ship_id];
    if (!ship) {
      console.warn(`player ${player.id} ship ${player.ship_id} not found`);
      continue;
    }
    let shipProps: [string, string, IVector, number] = [
      ship.id,
      player.name,
      shiftPos(ship),
      ship.radius,
    ];
    res.push(shipProps);
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
