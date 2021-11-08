import NetState, { NetStateIndexes } from '../NetState';
import { GameState } from '../../../world/pkg';
import React from 'react';
import { Text } from '@react-three/drei';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { teal } from '../utils/palette';
import { vecToThreePos } from './util';

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

const getNamesWithPos = (
  state: GameState,
  indexes: NetStateIndexes
): NameWithPos[] => {
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

  for (const ship of state.locations[0].ships) {
    if (ship.docked_at) {
      continue;
    }
    const player = indexes.playersByShipId.get(ship.id);
    const ship_name = ship.name ? ship.name : 'Unidentified';
    const name = player ? player.name : ship_name;
    res.push({
      id: ship.id,
      name,
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
  const names = getNamesWithPos(netState.state, netState.indexes);
  return (
    <>
      {names.map((nameWithPos: NameWithPos) => {
        // noinspection RequiredAttributes
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
