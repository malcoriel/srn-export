import useSWR from 'swr';
import { GameState, stateUrl } from './common';
import { Layer } from 'react-konva';
import { ShipShape } from './ShipShape';
import React from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export const ShipsLayer = () => {
  const { data: state } = useSWR<GameState>(stateUrl);
  if (!state) return null;
  console.log('ships layer');
  const { ships } = state;

  return (
    <Layer>
      {ships.map((s) => {
        return <ShipShape key={s.id} {...s} />;
      })}
    </Layer>
  );
};
