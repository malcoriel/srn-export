import useSWR from 'swr';
import { GameState } from './common';
import { Layer } from 'react-konva';
import { ShipShape } from './ShipShape';
import React from 'react';

export const ShipsLayer = () => {
  const { data: state } = useSWR<GameState>('http://localhost:8000/api/state');
  if (!state) return null;
  const { ships } = state;

  return (
    <Layer>
      {ships.map((s) => {
        return <ShipShape key={s.id} {...s} />;
      })}
    </Layer>
  );
};
