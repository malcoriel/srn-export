import Vector, { IVector } from './utils/Vector';
import {
  Planet,
  Quest,
  Ship,
  Star,
  Player,
  Leaderboard,
  Dialogue,
  Substitution,
  DialogueElem,
  InventoryItem,
  TradeAction,
  Price,
  Market,
  NatSpawnMineral,
  Asteroid,
  AsteroidBelt,
  GameState,
  Notification,
  NotificationText,
} from '../../world/pkg';
import {
  CargoDeliveryQuestState,
  SubstitutionType,
  InventoryItemType,
  GameMode,
} from '../../world/pkg/world.extra';

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

export const SHIP_SPEED = 20.0;

export type AABB = {
  top_left: Vector;
  bottom_right: Vector;
};

export enum SandboxCommandName {
  Unknown = 'Unknown',
  AddStar = 'AddStar',
  AddPlanet = 'AddPlanet',
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

export enum ShipActionType {
  Unknown = 'Unknown',
  Move = 'Move',
  Dock = 'Dock',
  Navigate = 'Navigate',
  DockNavigate = 'DockNavigate',
  Tractor = 'Tractor',
}

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

export class ShipAction {
  constructor(public s_type: ShipActionType, public data?: any) {}

  public static Move = (dir: Direction) =>
    new ShipAction(ShipActionType.Move, dir);

  public static Dock = () => new ShipAction(ShipActionType.Dock, '');

  public static Navigate = (to: IVector) =>
    new ShipAction(ShipActionType.Navigate, to);

  public static DockNavigate = (to: string) =>
    new ShipAction(ShipActionType.DockNavigate, to);

  public static Tractor = (obj_id: string) =>
    new ShipAction(ShipActionType.Tractor, obj_id);

  public serialize(): string {
    return JSON.stringify({
      s_type: this.s_type,
      data: JSON.stringify(this.data),
    });
  }

  public serialize_for_wasm(): any {
    return {
      s_type: this.s_type,
      data: JSON.stringify(this.data),
    };
  }
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
  wasmFunctions.set_panic_hook();
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

const applyShipActionWasm = (
  state: GameState,
  ship_action: ShipAction
): Ship | undefined => {
  return doWasmCall<Ship>(
    'apply_ship_action',
    JSON.stringify(
      {
        state,
        ship_action: ship_action.serialize_for_wasm(),
        player_id: state.my_id,
      },
      null,
      2
    )
  );
};

export const applyShipAction = (
  myShip: Ship,
  sa: ShipAction,
  state: GameState,
  elapsedMs: number,
  ping: number,
  limitArea: AABB
) => {
  const moveByTime = (SHIP_SPEED * elapsedMs) / 1000;
  const stateConsideringPing = updateWorld(state, limitArea, ping) || state;
  const moveByTimeDiagonal = (moveByTime * Math.sqrt(2)) / 2;
  switch (sa.s_type) {
    case ShipActionType.Dock: {
      const newShip = applyShipActionWasm(stateConsideringPing, sa);
      if (newShip) {
        // eslint-disable-next-line no-param-reassign
        myShip = { ...newShip };
      }
      break;
    }

    case ShipActionType.Move: {
      myShip.dock_target = null;
      myShip.navigate_target = undefined;
      myShip.trajectory = [];
      const direction = sa.data as Direction;
      switch (direction) {
        case Direction.Up:
          myShip.y -= moveByTime;
          break;
        case Direction.UpRight:
          myShip.x += moveByTimeDiagonal;
          myShip.y -= moveByTimeDiagonal;
          break;
        case Direction.Right:
          myShip.x += moveByTime;
          break;
        case Direction.DownRight:
          myShip.y += moveByTimeDiagonal;
          myShip.x += moveByTimeDiagonal;
          break;
        case Direction.Down:
          myShip.y += moveByTime;
          break;
        case Direction.DownLeft:
          myShip.y += moveByTimeDiagonal;
          myShip.x -= moveByTimeDiagonal;
          break;
        case Direction.Left:
          myShip.x -= moveByTime;
          break;
        case Direction.UpLeft:
          myShip.y -= moveByTimeDiagonal;
          myShip.x -= moveByTimeDiagonal;
          break;
        default:
          console.warn('default case for direction');
          break;
      }
      const directionToRotationElement = directionToRotation[direction];
      // noinspection SuspiciousTypeOfGuard
      if (typeof directionToRotationElement !== 'number') {
        console.error(
          'move produced invalid rotation',
          directionToRotationElement
        );
      }
      myShip.rotation = directionToRotationElement;
      break;
    }
    case ShipActionType.Navigate: {
      const newShip = applyShipActionWasm(stateConsideringPing, sa);
      if (newShip) {
        // eslint-disable-next-line no-param-reassign
        myShip = { ...newShip };
      }
      break;
    }
    case ShipActionType.Tractor: {
      const newShip = applyShipActionWasm(stateConsideringPing, sa);
      if (newShip) {
        // eslint-disable-next-line no-param-reassign
        myShip = { ...newShip };
      }

      break;
    }
    case ShipActionType.DockNavigate: {
      const newShip = applyShipActionWasm(stateConsideringPing, sa);
      if (newShip) {
        // eslint-disable-next-line no-param-reassign
        myShip = { ...newShip };
      }
      break;
    }
    default:
      console.warn('unknown action', sa);
      break;
  }
  return myShip;
};
export const findPlanet = (
  state: GameState,
  id: string
): Planet | undefined => {
  return state.locations[0].planets.find((p) => p.id === id);
};
