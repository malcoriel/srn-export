import { Planet } from '../../../world/pkg';
import React from 'react';
import { ThreePlanetShape } from './ThreePlanetShape';
import { InteractorMap } from './InteractorMap';
import { normalizeHealth } from '../world';

export const possibleGasGiantColors = [
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
