// that import type is important - this file is used in jest tests that cannot consume wasm directly.
// it is possible to split it properly if I make more codemods fully extracting typing part out of pkg
import type {
  FullObjectSpecifier,
  GameState,
  NatSpawnMineral,
  PlanetV2,
  Player,
  Ship,
} from './world';
import Vector, { isIVector, IVector } from './utils/Vector';
import { ObjectSpecifierBuilder } from '../../world/pkg/world.extra';
import { UnreachableCaseError } from 'ts-essentials';
import { Container, ObjectSpecifier } from '../../world/pkg/world';
import _ from 'lodash';

export interface ClientStateIndexes {
  myShip: Ship | null;
  myShipPosition: Vector | null;
  playersById: Map<string, Player>;
  planetsById: Map<string, PlanetV2>;
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
      return null;
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
    case 'Asteroid': {
      const spec = specifier.obj_spec;
      return loc.asteroids.find((o) => o.id === spec.id);
    }
    case 'AsteroidBelt': {
      const spec = specifier.obj_spec;
      return loc.asteroid_belts.find((o) => o.id === spec.id);
    }
    case 'Wreck': {
      const spec = specifier.obj_spec;
      return loc.wrecks.find((o) => o.id === spec.id);
    }
    case 'Location': {
      const spec = specifier.obj_spec;
      return state.locations.find((l) => l.id === spec.id);
    }
    default:
      throw new UnreachableCaseError(specifier.obj_spec);
  }
};

// there's almost 0 cases where client needs anything but the current location for now
export const findObjectBySpecifierLoc0 = (
  state: GameState,
  spec: ObjectSpecifier
) => {
  return findObjectBySpecifier(state, { loc_idx: 0, obj_spec: spec });
};

export const findObjectPosition = (obj: any): IVector | null => {
  if (obj.spatial && isIVector(obj.spatial.position)) {
    return {
      x: obj.spatial.position.x,
      y: obj.spatial.position.y,
    };
  }
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
  return null;
};

export const findObjectRotation = (obj: any): number | null => {
  if (!obj) {
    return null;
  }
  if (typeof obj.rotation !== 'undefined') {
    return obj.rotation;
  }
  if (typeof obj.spatial?.rotation_rad !== 'undefined') {
    return obj.spatial.rotation_rad;
  }
  return null;
};

export const setObjectPosition = (obj: any, newVal: IVector): void => {
  if (isIVector(obj)) {
    obj.x = newVal.x;
    obj.y = newVal.y;
    return;
  }
  if (obj.position && isIVector(obj.position)) {
    obj.position.x = newVal.x;
    obj.position.y = newVal.y;
    return;
  }
  if (obj.spatial && isIVector(obj.spatial.position)) {
    obj.spatial.position.x = newVal.x;
    obj.spatial.position.y = newVal.y;
    return;
  }
  throw new Error('Could not set object position');
};

export const setObjectRotation = (obj: any, newVal: number): void => {
  if (typeof obj.rotation !== 'undefined') {
    obj.rotation = newVal;
    return;
  }
  if (typeof obj.spatial?.rotation_rad !== 'undefined') {
    obj.spatial.rotation_rad = newVal;
    return;
  }
  throw new Error('Could not set object rotation');
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
      indexes.myShipPosition = Vector.fromIVector(myShip.spatial.position);
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

export enum FindObjectHint {
  Planet,
}

export type FindableObject = PlanetV2 | NatSpawnMineral | Container | Ship;
export type FindObjectResult<T = any> =
  | {
      object: T;
      locIndex: number;
    }
  | undefined;
/*
  @deprecated this function is REALLY bad performance-wise. Use findByObjectSpec
 */
export const findObjectById = (
  state: GameState,
  objId: string,
  // for further optimizations like what type & location, but for now just pure search
  _hints?: FindObjectHint[]
): FindObjectResult => {
  // considering the fact server only provides 0-th location, this is safe to
  // iterate them all, for now
  for (let i = 0; i < state.locations.length; i++) {
    const loc = state.locations[i];
    let found;
    found = loc.planets.find((p) => p.id === objId);
    if (found) {
      return {
        object: found,
        locIndex: i,
      };
    }
    found = loc.ships.find((p) => p.id === objId);
    if (found) {
      return {
        object: found,
        locIndex: i,
      };
    }
    found = loc.minerals.find((p) => p.id === objId);
    if (found) {
      return {
        object: found,
        locIndex: i,
      };
    }
    found = loc.containers.find((p) => p.id === objId);
    if (found) {
      return {
        object: found,
        locIndex: i,
      };
    }
  }
  return undefined;
};
export const getObjectPosition = (obj: any): IVector => {
  const pos = findObjectPosition(obj);
  if (!pos) {
    throw new Error('Invalid object for getObjectPosition');
  }
  return pos;
};
export const getObjectRotation = (obj: any): number => {
  const rot = findObjectRotation(obj);
  if (rot === null) {
    throw new Error('Invalid object for getObjectRotation');
  }
  return rot;
};
export const findObjectPositionById = (
  state: GameState,
  objId: string
): Vector | null => {
  const objRes = findObjectById(state, objId);
  if (!objRes) {
    return null;
  }
  const { object } = objRes;
  return Vector.fromIVector(getObjectPosition(object));
};
