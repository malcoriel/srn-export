// that import type is important - this file is used in jest tests that cannot consume wasm directly.
// it is possible to split it properly if I make more codemods fully extracting typing part out of pkg
import type {
  FullObjectSpecifier,
  GameState,
  Planet,
  Player,
  Ship,
} from './world';
import Vector, { isIVector, IVector } from './utils/Vector';
import { ObjectSpecifierBuilder } from '../../world/pkg/world.extra';
import { UnreachableCaseError } from 'ts-essentials';

export interface ClientStateIndexes {
  myShip: Ship | null;
  myShipPosition: Vector | null;
  playersById: Map<string, Player>;
  planetsById: Map<string, Planet>;
  playersByShipId: Map<string, Player>;
  shipByPlayerId: Map<string, Ship>;
}

export const findMyPlayer = (state: GameState) =>
  state.players.find((player) => player.id === state.my_id);

export const findMyShipIndex = (state: GameState): number | null => {
  const myPlayer = findMyPlayer(state);
  if (!myPlayer) return null;

  const foundShipIndex = state.locations[0].ships.findIndex(
    (ship) => ship.id === myPlayer.ship_id
  );
  if (foundShipIndex === -1) return null;
  return foundShipIndex;
};

export const findMyShip = (state: GameState): Ship | null => {
  const index = findMyShipIndex(state);
  if (index !== -1 && index !== null) return state.locations[0].ships[index];
  return null;
};

export const findObjectBySpecifier = (
  state: GameState,
  specifier: FullObjectSpecifier
): any => {
  const loc = state.locations[specifier.loc_idx];
  switch (specifier.obj_spec.tag) {
    case 'Unknown':
      return undefined;
    case 'Mineral': {
      const spec = specifier.obj_spec;
      return loc.minerals.find((m) => m.id === spec.id);
    }
    case 'Container': {
      const spec = specifier.obj_spec;
      return loc.containers.find((c) => c.id === spec.id);
    }
    case 'Planet': {
      const spec = specifier.obj_spec;
      return loc.planets.find((o) => o.id === spec.id);
    }
    case 'Ship': {
      const spec = specifier.obj_spec;
      return loc.ships.find((o) => o.id === spec.id);
    }
    case 'Star': {
      return loc.star?.id === specifier.obj_spec.id ? loc.star : undefined;
    }
    default:
      throw new UnreachableCaseError(specifier.obj_spec);
  }
};
export const findObjectPosition = (obj: any): IVector | null => {
  if (isIVector(obj)) {
    return {
      x: obj.x,
      y: obj.y,
    };
  }
  if (obj.position && isIVector(obj.position)) {
    return {
      x: obj.position.x,
      y: obj.position.y,
    };
  }
  if (obj.spatial && isIVector(obj.spatial.position)) {
    return {
      x: obj.spatial.position.x,
      y: obj.spatial.position.y,
    };
  }
  return null;
};
export const buildClientStateIndexes = (state: GameState) => {
  const indexes: ClientStateIndexes = {
    myShip: null,
    myShipPosition: null,
    playersById: new Map(),
    planetsById: new Map(),
    playersByShipId: new Map(),
    shipByPlayerId: new Map(),
  };
  const myShip = findMyShip(state);
  indexes.myShip = myShip;
  if (myShip) {
    if (myShip.docked_at) {
      const planet = findObjectBySpecifier(state, {
        loc_idx: 0,
        obj_spec: ObjectSpecifierBuilder.ObjectSpecifierPlanet({
          id: myShip.docked_at,
        }),
      });
      const myShipPosition = findObjectPosition(planet);
      if (myShipPosition) {
        indexes.myShipPosition = Vector.fromIVector(myShipPosition);
      }
    } else {
      indexes.myShipPosition = Vector.fromIVector(myShip);
    }
  }
  for (const player of state.players) {
    indexes.playersById.set(player.id, player);
    if (player.ship_id) {
      indexes.playersByShipId.set(player.ship_id, player);
    }
  }
  for (const planet of state.locations[0].planets) {
    indexes.planetsById.set(planet.id, planet);
  }
  for (const ship of state.locations[0].ships) {
    const player = indexes.playersByShipId.get(ship.id);
    if (player) {
      indexes.shipByPlayerId.set(player.id, ship);
    }
  }
  return indexes;
};
