import Vector, { IVector } from './utils/Vector';

export const size = {
  width_px: window.innerWidth,
  height_px: window.innerHeight,
  getMinSize: () => Math.min(size.width_px, size.height_px),
};

export const viewPortSizePixels = () =>
  new Vector(size.width_px, size.height_px);

let pixels_per_unit = 10;
export const viewPortSizeMeters = () =>
  new Vector(size.width_px / pixels_per_unit, size.height_px / pixels_per_unit);
// noinspection JSUnusedGlobalSymbols
export const width_units = 1000;
// noinspection JSUnusedGlobalSymbols
export const height_units = 1000;
export const max_x = width_units / 2;
export const max_y = height_units / 2;
export const min_x = -max_x;
export const min_y = -max_y;

export const unitsToPixels_x = () => pixels_per_unit;
export const unitsToPixels_y = () => pixels_per_unit;
export const unitsToPixels_min = () =>
  Math.min(unitsToPixels_x(), unitsToPixels_y());

export const SHIP_SPEED = 20.0;

export const radToDeg = (x: number) => (x * 180) / Math.PI;
export const degToRad = (x: number) => (x * Math.PI) / 180;

export const stateUrl = 'http://localhost:8000/api/state';

export type WithId = {
  id: string;
};

export type WithName = {
  name: string;
};

export type WithColor = {
  color: string;
};

export type GameObject = WithId &
  IVector & {
    rotation: number;
    radius: number;
  };

export type Planet = GameObject &
  WithName &
  WithColor & {
    anchor_tier: number;
    anchor_id: string;
    orbit_speed: number;
  };
export type Star = GameObject & WithName & WithColor;

export type HpEffect = {
  hp: number;
  id: string;
  tick: number;
};

export type Ship = GameObject &
  WithColor & {
    docked_at?: string;
    navigate_target?: IVector;
    dock_target?: string;
    tractor_target?: string;
    trajectory: IVector[];
    hp: number;
    max_hp: number;
    hp_effects: HpEffect[];
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

export type Player = WithId & {
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

export type DialogueSubstitution = {
  s_type: DialogueSubstitutionType;
  text: string;
  id: string;
};

export type DialogueElem = {
  text: string;
  id: string;
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

export type AsteroidBelt = GameObject & {
  width: number;
  count: number;
  orbit_speed: number;
  scale_mod: number;
};
export type Asteroid = GameObject & {};

export type NatSpawnMineral = GameObject &
  WithColor & {
    value: number;
  };

export type GameState = {
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

export const findMineral = (state: GameState, min_id: string) => {
  return state.minerals.find((m) => m.id === min_id);
};

export const applyShipAction = (
  myShip: Ship,
  sa: ShipAction,
  state: GameState,
  elapsedMs: number,
  ping: number
) => {
  const moveByTime = (SHIP_SPEED * elapsedMs) / 1000;
  const stateConsideringPing = updateWorld(state, ping) || state;
  const moveByTimeDiagonal = (moveByTime * Math.sqrt(2)) / 2;
  switch (sa.s_type) {
    case ShipActionType.Dock: {
      const shipV = Vector.fromIVector(myShip);
      if (myShip.docked_at) {
        myShip.docked_at = undefined;
      } else {
        for (const planet of stateConsideringPing.planets) {
          const planetV = Vector.fromIVector(planet);
          if (planetV.euDistTo(shipV) < planet.radius) {
            myShip.docked_at = planet.id;
            break;
          }
        }
      }
      break;
    }

    case ShipActionType.Move: {
      myShip.dock_target = undefined;
      myShip.navigate_target = undefined;
      myShip.trajectory = [];
      let direction = sa.data as Direction;
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
      }
      let directionToRotationElement = directionToRotation[direction];
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
      myShip.dock_target = undefined;
      myShip.docked_at = undefined;
      myShip.trajectory = [];
      let navigate_target = sa.data as IVector;
      myShip.navigate_target = { x: navigate_target.x, y: navigate_target.y };
      break;
    }
    case ShipActionType.Tractor: {
      let mineralId = sa.data as string;
      let mineral = findMineral(state, mineralId);
      if (
        mineral &&
        Vector.fromIVector(myShip).euDistTo(Vector.fromIVector(mineral)) <= 30
      ) {
        myShip.tractor_target = mineralId;
      }

      break;
    }
    case ShipActionType.DockNavigate: {
      myShip.navigate_target = undefined;
      myShip.docked_at = undefined;
      myShip.dock_target = sa.data as string;
      break;
    }
    default:
      console.warn('unknown action', sa);
      break;
  }
  return myShip;
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
  let match = resultMessage.match(/at line (\d+) column (\d+)/);

  if (match) {
    const lines = serializedState.split('\n');
    const lineNumber = Number(match[1]);

    const inState = JSON.parse(serializedState) as GameState;
    console.log(inState.ships.filter((s: Ship) => !s.rotation));

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
  let res = fn(...args);
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
  if (result.message) {
    let serializedInState = args[0];
    console.warn(
      `wasm function ${fnName} produced an error with message:\n`,
      result.message
    );
    console.warn(new Error());
    exposeJsonParseError(serializedInState, result.message);

    return undefined;
  }
  return result;
};
export const updateWorld = (
  inState: GameState,
  elapsedMs: number
): GameState | undefined => {
  return doWasmCall<GameState>(
    'update_world',
    JSON.stringify(inState, null, 2),
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
