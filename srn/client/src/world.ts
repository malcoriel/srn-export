import Vector, { IVector } from './utils/Vector';
import {
  Action,
  ActionGas,
  ActionReverse,
  ActionTurnLeft,
  ActionTurnRight,
  Asteroid,
  AsteroidBelt,
  Container,
  Dialogue,
  DialogueElem,
  FullObjectSpecifier,
  GameState,
  Health,
  InventoryItem,
  Leaderboard,
  Location,
  Market,
  NatSpawnMineral,
  Notification,
  NotificationText,
  ObjectSpecifier,
  Planet,
  Player,
  Price,
  Quest,
  Ship,
  Star,
  Substitution,
  TradeAction,
} from '../../world/pkg';
import {
  CargoDeliveryQuestState,
  GameMode,
  InventoryItemType,
  SubstitutionType,
} from '../../world/pkg/world.extra';
import _ from 'lodash';
import { Dictionary } from 'ts-essentials';
import { findObjectPosition } from './ClientStateIndexing';

export type {
  Notification,
  NotificationText,
  NatSpawnMineral,
  Asteroid,
  AsteroidBelt,
  Planet,
  Ship,
  Star,
  Quest,
  Player,
  Leaderboard,
  Dialogue,
  Substitution,
  DialogueElem,
  InventoryItem,
  TradeAction,
  Price,
  Market,
  GameState,
  FullObjectSpecifier,
};
export {
  CargoDeliveryQuestState,
  SubstitutionType,
  InventoryItemType,
  GameMode,
};
// noinspection JSUnusedGlobalSymbols
export const width_units = 1000;
// noinspection JSUnusedGlobalSymbols
export const height_units = 1000;
export const max_x = width_units / 2;
export const max_y = height_units / 2;
export const min_x = -max_x;
// noinspection JSUnusedGlobalSymbols
export const min_y = -max_y;

export type AABB = {
  top_left: Vector;
  bottom_right: Vector;
};

export enum SandboxCommandName {
  Unknown = 'Unknown',
  AddStar = 'AddStar',
  AddContainer = 'AddContainer',
  AddMineral = 'AddMineral',
  ToggleGodMode = 'ToggleGodMode',
  GetSomeWares = 'GetSomeWares',
  Teleport = 'Teleport',
}

export enum PlanetType {
  Unknown = 'Unknown',
  Ice = 'Ice',
  Jovian = 'Jovian',
  Jungle = 'Jungle',
  Barren = 'Barren',
}

export enum SandboxTeleportTarget {
  Unknown = 'Unknown',
  Zero = 'Zero',
}

export type SandboxCommand =
  | SandboxCommandName.AddStar
  | SandboxCommandName.AddContainer
  | SandboxCommandName.AddMineral
  | SandboxCommandName.ToggleGodMode
  | SandboxCommandName.GetSomeWares
  | {
      AddPlanet: {
        p_type: PlanetType;
        orbit_speed: number;
        radius: number;
        anchor_id: string;
      };
    }
  | {
      Teleport: {
        target: SandboxTeleportTarget;
      };
    };

export const isStateTutorial = (st: GameState) => {
  return st.mode === GameMode.Tutorial;
};

export enum Direction {
  Unknown,
  Up,
  UpRight,
  Right,
  DownRight,
  Down,
  DownLeft,
  Left,
  UpLeft,
}

const directionToRotation = {
  [Direction.Unknown]: 0,
  [Direction.Up]: 0,
  [Direction.UpRight]: Math.PI / 4,
  [Direction.Right]: Math.PI / 2,
  [Direction.UpLeft]: -Math.PI / 4,
  [Direction.Left]: -Math.PI / 2,
  [Direction.DownLeft]: -Math.PI * 0.75,
  [Direction.Down]: Math.PI,
  [Direction.DownRight]: Math.PI * 0.75,
};

export const TRACTOR_DIST = 30;

export const findMineral = (state: GameState, min_id: string) => {
  return state.locations[0].minerals.find((m) => m.id === min_id);
};

export const findContainer = (state: GameState, cont_id: string) => {
  return state.locations[0].containers.find((c) => c.id === cont_id);
};

let wasmFunctions: any = {};

(async function () {
  wasmFunctions = await import('../../world/pkg');
  // jest would complain otherwise, due to the hack with resolver that I had to do
  // the world/pkg/world_bg.js does not get imported when this file (world.ts) is imported via jest
  if (wasmFunctions && wasmFunctions.set_panic_hook) {
    wasmFunctions.set_panic_hook();
  }
})();

const exposeJsonParseError = (
  serializedState: string,
  resultMessage: string
) => {
  const match = resultMessage.match(/at line (\d+) column (\d+)/);

  if (match) {
    const lines = serializedState.split('\n');
    const lineNumber = Number(match[1]);

    console.log(
      lines[lineNumber - 3] || '',
      '\n',
      lines[lineNumber - 2] || '',
      '\n',
      'here ----> ',

      lines[lineNumber - 1] || '',
      '\n',
      lines[lineNumber],
      '\n',
      lines[lineNumber + 1] || '',
      '\n',
      lines[lineNumber + 2] || '',
      '\n',
      lines[lineNumber + 3] || '',
      '\n'
    );
  }
};

const doWasmCall = <R>(fnName: string, ...args: any[]): R | undefined => {
  const fn = wasmFunctions[fnName];
  if (!fn) {
    console.warn(`wasm function ${fnName} is not yet initialized`);
    return undefined;
  }
  if (fn.length !== args.length) {
    console.warn(
      `wasm function ${fnName} length ${fn.length} does not equal args length ${args.length}`
    );
    return undefined;
  }
  const res = fn(...args);
  if (!res) {
    console.warn(`wasm function ${fnName} returned nothing`);
    return undefined;
  }
  let result;
  try {
    result = JSON.parse(res);
  } catch (e) {
    console.warn(`wasm function ${fnName} produced an invalid json`);
  }
  if (!result) {
    console.warn(`wasm function ${fnName} produced no result:`, result);
    return undefined;
  }
  if (result.message) {
    console.warn(
      `wasm function ${fnName} produced an error with message:\n`,
      result.message
    );
    console.warn(new Error());
    exposeJsonParseError(args[0], result.message);

    return undefined;
  }
  return result;
};
export const updateWorld = (
  inState: GameState,
  limit_area: AABB,
  elapsedMs: number
): GameState | undefined => {
  return doWasmCall<GameState>(
    'update_world',
    JSON.stringify({ state: inState, limit_area }, null, 2),
    BigInt(elapsedMs * 1000)
  );
};

const parseState = (inState: GameState): GameState | undefined => {
  return doWasmCall<GameState>('parse_state', JSON.stringify(inState, null, 2));
};

export const validateState = (inState: GameState): boolean => {
  const parsed = parseState(inState);
  return !!parsed;
};

export const restoreReplayFrame = (
  prevTicks: number,
  nextTicks: number | null,
  currentTicks: number
): GameState | null => {
  if (nextTicks !== null) {
    return wasmFunctions.get_preloaded_diff_replay_state_at_interpolated(
      Math.round(prevTicks),
      Math.round(nextTicks),
      (currentTicks - prevTicks) / (nextTicks - prevTicks)
    );
  }
  return wasmFunctions.get_preloaded_diff_replay_state_at(
    Math.round(prevTicks)
  );
};

export const loadReplayIntoWasm = (replay: any) => {
  wasmFunctions.load_replay(replay);
};

export const applyShipActionWasm = (
  state: GameState,
  ship_action: Action
): Ship | undefined => {
  return doWasmCall<Ship>(
    'apply_ship_action',
    JSON.stringify(
      {
        state,
        ship_action,
        player_id: state.my_id,
      },
      null,
      2
    )
  );
};

export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.locations[0].planets.find((p) => p.id === id);
};

export enum FindObjectHint {
  Planet,
}

type FindableObject = Planet | NatSpawnMineral | Container | Ship;
type FindObjectResult =
  | {
      object: FindableObject;
      locIndex: number;
    }
  | undefined;
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

export const indexShipsByPlayerId = (
  loc: Location,
  players: Player[]
): Record<string, Ship> => {
  const playersByShip = _.keyBy(
    players,
    (p: Player) => p.ship_id
  ) as Dictionary<Player>;
  const res: Record<string, Ship> = {};
  for (const ship of loc.ships) {
    if (playersByShip[ship.id]) {
      res[playersByShip[ship.id].id] = ship;
    }
  }
  return res;
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

export const getSpecifierId = (os?: ObjectSpecifier | null): string | null => {
  if (!os || os.tag === 'Unknown') return null;
  return os.id || null;
};

export type ManualMovementActionTags =
  | 'Gas'
  | 'Reverse'
  | 'TurnRight'
  | 'TurnLeft';

export type ManualMovementAction =
  | ActionGas
  | ActionReverse
  | ActionTurnRight
  | ActionTurnLeft;

export const isManualMovement = (act: Action): act is ManualMovementAction => {
  return (
    act.tag === 'Gas' ||
    act.tag === 'Reverse' ||
    act.tag === 'TurnRight' ||
    act.tag === 'TurnLeft'
  );
};

export const normalizeHealth = (
  h: Health | null | undefined
): number | undefined => {
  return h ? h.current / h.max : undefined;
};
