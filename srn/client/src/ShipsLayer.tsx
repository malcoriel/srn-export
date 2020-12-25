import { GameState } from './common';
import { Layer } from 'react-konva';
import { ShipShape } from './ShipShape';
import React from 'react';

export const ShipsLayer: React.FC<{ state: GameState }> = ({ state }) => {
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
