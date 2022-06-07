import { PlanetV2 } from '../../../world/pkg';
import React from 'react';
import { ThreePlanetShape } from './ThreePlanetShape';
import { InteractorMap } from './InteractorMap';
import { normalizeHealth } from '../world';

interface ThreePlanetsLayerParams {
  planets: PlanetV2[];
  visMap: Record<string, boolean>;
}

export const ThreePlanetsLayer: React.FC<ThreePlanetsLayerParams> = ({
  planets,
  visMap,
}) => (
  <>
    {planets.map((p) => {
      return (
        <ThreePlanetShape
          gid={p.id}
          radius={p.spatial.radius}
          // onClick={(evt: MouseEvent) => {
          //   evt.stopPropagation();
          //   actionsActive[
          //     ShipActionType.DockNavigate
          //   ] = ShipAction.DockNavigate(p.id);
          // }}
          position={p.spatial.position}
          key={p.id}
          color={p.color}
          atmosphereColor={p.color}
          visible={visMap[p.id]}
          interactor={InteractorMap.planet(p)}
          hpNormalized={normalizeHealth(p.health)}
        />
      );
    })}
  </>
);
