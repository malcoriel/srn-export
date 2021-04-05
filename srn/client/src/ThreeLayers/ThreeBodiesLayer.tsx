import React from 'react';
import _ from 'lodash';
import { GameState, ShipAction, ShipActionType } from '../world';
import { ThreeStar, useRepeatWrappedTextureLoader } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';
import { ThreeRock } from './ThreeRock';
import {
  ThreePlanetShape,
  ThreePlanetShapeRandomProps,
} from './ThreePlanetShape';
import { actionsActive } from '../utils/ShipControls';
import { Texture } from 'three';

// from random_stuff.rs
const possibleColors = [
  '#0D57AC',
  '#AE213D',
  '#DE4C0A',
  '#05680D',
  '#01A6A0',
  '#9D91A1',
  '#AA6478',
  '#4D56A5',
  '#382C4F',
  '#AC54AD',
  '#8D948D',
  '#A0B472',
  '#C7B4A6',
  '#1D334A',
  '#5BBAA9',
  '#008FA9',
  '#ADBEA3',
  '#F5B0A1',
  '#A1A70B',
  '#025669',
  '#AE2460',
  '#955802',
  '#9C46B8',
  '#DE019B',
  '#DC890C',
  '#F68923',
  '#F4A261',
  '#E76F51',
  '#849324',
  '#FD151B',
  '#D8A47F',
  '#EF8354',
];

export const useColorTextures = () => {
  const res: Record<string, Texture> = {};
  for (const color of possibleColors) {
    const colorTexture = useRepeatWrappedTextureLoader(
      `resources/textures/gas-giants/${color
        .replace('#', '')
        .toUpperCase()}.png`
    );
    res[color] = colorTexture;
  }
  return res;
};

export const ThreeBodiesLayer: React.FC<{
  state: GameState;
  visMap: Record<string, boolean>;
}> = ({ visMap, state }) => {
  const { planets, star, minerals, asteroid_belts } = state;
  return (
    <group>
      {planets.map((p) => {
        const texture = null; //colorTextures[p.color.replace('#', '').toUpperCase()];
        return (
          <ThreePlanetShape
            texture={new Texture()}
            radius={p.radius}
            {...ThreePlanetShapeRandomProps(p.id, p.radius)}
            onClick={(evt: MouseEvent) => {
              evt.stopPropagation();
              actionsActive[
                ShipActionType.DockNavigate
              ] = ShipAction.DockNavigate(p.id);
            }}
            position={p}
            key={p.id}
            color={p.color}
            visible={visMap[p.id]}
          />
        );
      })}
      {star && (
        <ThreeStar
          visible={visMap[star.id]}
          scale={_.times(3, () => star.radius) as [number, number, number]}
          position={posToThreePos(star.x, star.y)}
          color={star.color}
        />
      )}
      {asteroid_belts.map((b) => (
        <ThreeAsteroidBelt
          key={b.id}
          count={b.count}
          radius={b.radius}
          position={posToThreePos(b.x, b.y)}
          width={b.width}
          rotation={[0, 0, b.rotation]}
          gid={b.id}
          scale_mod={b.scale_mod}
        />
      ))}
      {minerals.map((m) => (
        <ThreeRock
          gid={m.id}
          key={m.id}
          radius={m.radius}
          position={posToThreePos(m.x, m.y)}
          color={m.color}
        />
      ))}
      {/*{asteroids.map((a: Asteroid) => (*/}
      {/*  <ThreeRock*/}
      {/*    key={a.id}*/}
      {/*    position={posToThreePos(a.x, a.y)}*/}
      {/*    scale={_.times(3, () => a.radius) as [number, number, number]}*/}
      {/*  />*/}
      {/*))}*/}
    </group>
  );
};
