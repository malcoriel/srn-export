import { GameState } from './world';
import { Layer } from 'react-konva';
import { ShipShape } from './ShipShape';
import React from 'react';
import _ from 'lodash';

export const ShipsLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { ships, players } = state;

  const byShipId = _.keyBy(players, 'ship_id');

  return (
    <Layer>
      {ships.map((s) => {
        let { name: player_name = 'player' } = byShipId[s.id] || {
          name: 'player',
        };
        return <ShipShape key={s.id} {...s} name={player_name} />;
      })}
    </Layer>
  );
};
