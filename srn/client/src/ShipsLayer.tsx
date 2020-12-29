import { GameState } from './world';
import { Layer } from 'react-konva';
import { ShipShape } from './ShipShape';
import React from 'react';
import _ from 'lodash';

export const ShipsLayer: React.FC<{ state: GameState }> = ({ state }) => {
  if (!state) return null;
  const { ships, players, planets } = state;

  const playersByShipId = _.keyBy(players, 'ship_id');
  const planetsById = _.keyBy(planets, 'id');

  return (
    <Layer>
      {ships.map((s, i) => {
        let { name: player_name = 'player' } = playersByShipId[s.id] || {
          name: 'player',
        };
        let shipPos = {
          x: s.x,
          y: s.y,
        };
        if (s.docked_at) {
          let dockPlanet = planetsById[s.docked_at];
          if (dockPlanet) {
            shipPos.x = dockPlanet.x;
            shipPos.y = dockPlanet.y;
          }
        }
        return (
          <ShipShape key={s.id + i} {...s} name={player_name} {...shipPos} />
        );
      })}
    </Layer>
  );
};
