import { Planet } from '../../../world/pkg';
import React from 'react';
import { ThreePlanetShape } from './ThreePlanetShape';
import { InteractorMap } from './InteractorMap';
import { normalizeHealth } from '../world';

interface ThreePlanetsLayerParams {
  planets: Planet[];
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
          radius={p.radius}
          // onClick={(evt: MouseEvent) => {
          //   evt.stopPropagation();
          //   actionsActive[
          //     ShipActionType.DockNavigate
          //   ] = ShipAction.DockNavigate(p.id);
          // }}
          position={p}
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
