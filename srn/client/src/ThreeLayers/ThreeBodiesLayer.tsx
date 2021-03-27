import React from 'react';
import _ from 'lodash';
import { GameState, ShipAction, ShipActionType } from '../world';
import { ThreeStar } from './ThreeStar';
import { posToThreePos } from './ThreeLayer';
import { ThreeAsteroidBelt } from './ThreeAsteroidBelt';
import { ThreeRock } from './ThreeRock';
import {
  ThreePlanetShape2,
  ThreePlanetShape2RandomProps,
} from './ThreePlanetShape2';
import { actionsActive } from '../utils/ShipControls';

export const ThreeBodiesLayer: React.FC<{
  state: GameState;
  visMap: Record<string, boolean>;
}> = ({ visMap, state }) => {
  const { planets, star, minerals, asteroid_belts } = state;
  return (
    <group>
      {planets.map((p) => (
        <ThreePlanetShape2
          radius={p.radius}
          {...ThreePlanetShape2RandomProps(p.id, p.radius)}
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
      ))}
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
