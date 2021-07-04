import NetState from '../NetState';
import { GameState } from '../../../world/pkg';
import React from 'react';
import { Text } from '@react-three/drei';
import { vecToThreePos } from './ThreeLayer';
import Vector, { IVector, VectorF } from '../utils/Vector';
import _ from 'lodash';
import { teal } from '../utils/palette';

interface ThreeShipNamesParams {
  netState: NetState;
  visMap: Record<string, boolean>;
}

type NameWithPos = {
  id: string;
  name: string;
  pos: IVector;
  radius: number;
};

const getNamesWithPos = (state: GameState): NameWithPos[] => {
  const res: NameWithPos[] = [];
  for (const planet of state.locations[0].planets) {
    res.push({
      id: planet.id,
      name: planet.name,
      pos: Vector.fromIVector(planet),
      radius: planet.radius,
    });
  }

  if (state.locations[0].star) {
    const star = state.locations[0].star;
    res.push({
      id: star.id,
      name: star.name,
      pos: Vector.fromIVector(star),
      radius: star.radius,
    });
  }

  const shipsById = _.keyBy(state.locations[0].ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    const ship = shipsById[player.ship_id];
    if (!ship || ship.docked_at) {
      continue;
    }
    res.push({
      id: ship.id,
      name: player.name,
      pos: Vector.fromIVector(ship),
      radius: ship.radius,
    });
  }
  return res;
};

export const ThreeNames: React.FC<ThreeShipNamesParams> = ({
  netState,
  visMap,
}: ThreeShipNamesParams) => {
  const names = getNamesWithPos(netState.state);
  return (
    <>
      {names.map((nameWithPos: NameWithPos) => {
        return (
          <Text
            visible={visMap[nameWithPos.id]}
            position={vecToThreePos(
              Vector.fromIVector(nameWithPos.pos).add(
                VectorF(0, -4 - nameWithPos.radius)
              ),
              20
            )}
            key={nameWithPos.id}
            color={teal}
            fontSize={1.3}
            maxWidth={20}
            lineHeight={1}
            letterSpacing={0.02}
            textAlign="center"
            anchorX="center"
            anchorY="bottom" // default
          >
            {nameWithPos.name}
          </Text>
        );
      })}
    </>
  );
};
