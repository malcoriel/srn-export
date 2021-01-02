import React from 'react';
import { antiScale, GameState, scaleConfig } from '../world';
import NetState from '../NetState';
import { Layer, Text } from 'react-konva';
import Vector, { IVector } from '../utils/Vector';
import _ from 'lodash';
import { babyBlue } from '../utils/palette';

function extractNamePositions(
  state: GameState,
  cameraPosition: IVector,
  zoomProp: number
): Array<[string, string, IVector, number]> {
  const res = [];
  const cameraShift = Vector.fromIVector(cameraPosition);
  const shiftPos = (objPos: IVector) => {
    const pos = Vector.fromIVector(objPos);
    return pos.subtract(cameraShift).scale(1 / zoomProp);
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

export const NamesLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const names = extractNamePositions(
    state,
    visualState.cameraPosition,
    zoomProp
  );
  return (
    <Layer>
      {names.map(([id, name, position, radius]) => {
        let textWidth = 300;
        return (
          <Text
            key={id}
            text={name}
            position={position}
            fill={babyBlue}
            align="center"
            offsetY={
              (scaleConfig().scaleY / zoomProp) * radius -
              scaleConfig().offsetY / 2
            }
            width={textWidth}
            offsetX={textWidth / 2}
            {...antiScale()}
          />
        );
      })}
    </Layer>
  );
};
