import Vector, { IVector } from './utils/Vector';

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

export type Planet = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  name: string;
  color: string;
  anchor_tier: number;
  anchor_id: string;
  orbit_speed: number;
};
export type Star = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  name: string;
  color: string;
};

export type HpEffect = {
  hp: number;
  id: string;
  tick: number;
};

export type Ship = {
  id: string;
  x: number;
  y: number;
  rotation: number;
  radius: number;
  color: string;
  docked_at?: string;
  navigate_target?: IVector;
  dock_target?: string;
  tractor_target?: string;
  trajectory: IVector[];
  hp: number;
  max_hp: number;
  hp_effects: HpEffect[];
  inventory: InventoryItem[];
};

export type Quest = {
  from_id: string;
  to_id: string;
  reward: number;
  state: QuestState;
};

export enum QuestState {
  Unknown = 'Unknown',
  Started = 'Started',
  Picked = 'Picked',
  Delivered = 'Delivered',
}

export type Player = {
  id: string;
  ship_id?: string;
  name: string;
  quest?: Quest;
  state: QuestState;
  money: number;
  portrait_name: string;
};

export type Leaderboard = {
  rating: [Player, number][];
  winner: string;
};

export enum DialogueSubstitutionType {
  Unknown = 'Unknown',
  PlanetName = 'PlanetName',
  CharacterName = 'CharacterName',
  Generic = 'Generic',
}

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

export type TradeItem = [InventoryItemType, number];

export type TradeAction = {
  planet_id: string;
  sells_to_planet: TradeItem[];
  buys_from_planet: TradeItem[];
};

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

export type DialogueSubstitution = {
  s_type: DialogueSubstitutionType;
  text: string;
  id: string;
};

export type DialogueElem = {
  text: string;
  id: string;
  is_option: boolean;
  substitution: DialogueSubstitution[];
};

export type Dialogue = {
  id: string;
  options: DialogueElem[];
  prompt: DialogueElem;
  planet?: Planet;
  left_character: string;
  right_character: string;
};

export type AsteroidBelt = {
  id: string;
} & { x: number; y: number; rotation: number; radius: number } & {
  width: number;
  count: number;
  orbit_speed: number;
  scale_mod: number;
};
export type Asteroid = {
  id: string;
} & { x: number; y: number; rotation: number; radius: number };

export type NatSpawnMineral = {
  id: string;
} & {
  x: number;
  y: number;
  rotation: number;
  radius: number;
} & {
  color: string;
} & {
  value: number;
};

export enum InventoryItemType {
  Unknown = 'Unknown',
  CommonMineral = 'CommonMineral',
  UncommonMineral = 'UncommonMineral',
  RareMineral = 'RareMineral',
  QuestCargo = 'QuestCargo',
}

export type InventoryItem = {
  id: string;
  index: number;
  quantity: number;
  stackable: boolean;
  player_owned: boolean;
  item_type: InventoryItemType;
};

export enum GameMode {
  Unknown = 'Unknown',
  CargoRush = 'CargoRush',
  Tutorial = 'Tutorial',
  Sandbox = 'Sandbox',
}

export const isStateTutorial = (st: GameState) => {
  return st.mode === GameMode.Tutorial;
};

export type Price = {
  buy: number;
  sell: number;
};

export type Market = {
  wares: Record<string, InventoryItem[]>;
  prices: Record<string, Record<InventoryItemType, Price>>;
};

export type GameState = {
  seed: string;
  id: string;
  mode: GameMode;
  tag: string;
  leaderboard?: Leaderboard;
  planets: Planet[];
  ships: Ship[];
  players: Player[];
  minerals: NatSpawnMineral[];
  asteroids: Asteroid[];
  asteroid_belts: AsteroidBelt[];
  // technically bigint but serialization doesn't know yet
  start_time_ticks: number;
  ticks: number;
  my_id: string;
  star?: Star;
  paused: boolean;
  milliseconds_remaining: number;
  market: Market;
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
  return state.minerals.find((m) => m.id === min_id);
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
      myShip.dock_target = undefined;
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
