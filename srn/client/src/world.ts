import Vector, { IVector } from './utils/Vector';

export const width_px = 700;
export const height_px = 700;
// noinspection JSUnusedGlobalSymbols
export const width_units = 100;
// noinspection JSUnusedGlobalSymbols
export const height_units = 100;
export const max_x = 50;
export const max_y = 50;
export const min_x = -50;
export const min_y = -50;

export const unitsToPixels = 7;

export const SHIP_SPEED = 10.0;

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

export type Planet = GameObject & WithName & WithColor;
export type Star = GameObject & WithName & WithColor;

export type Ship = GameObject &
  WithColor & {
    docked_at?: string;
    navigate_target?: IVector;
    dock_target?: string;
    trajectory: IVector[];
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
};

export type Leaderboard = {
  rating: [Player, number][];
  winner: string;
};

export type GameState = {
  tag: string;
  leaderboard?: Leaderboard;
  planets: Planet[];
  ships: Ship[];
  players: Player[];
  // technically bigint but serialization doesn't know yet
  start_time_ticks: number;
  ticks: number;
  my_id: string;
  star?: Star;
  paused: boolean;
  milliseconds_remaining: number;
};

export const scaleConfig = {
  scaleX: 7,
  scaleY: 7,
  offsetX: -50,
  offsetY: -50,
};

export const antiScale = {
  scaleX: 1 / scaleConfig.scaleX,
  scaleY: 1 / scaleConfig.scaleY,
};

export const antiOffset = {
  offsetX: -scaleConfig.offsetX / antiScale.scaleX,
  offsetY: -scaleConfig.offsetY / antiScale.scaleY,
};

export enum ShipActionType {
  Unknown,
  Move,
  Dock,
  Navigate,
  DockNavigate,
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
  constructor(public type: ShipActionType, public data?: any) {}
  public static Move = (dir: Direction) =>
    new ShipAction(ShipActionType.Move, dir);
  public static Dock = () => new ShipAction(ShipActionType.Dock);
  public static Navigate = (to: IVector) =>
    new ShipAction(ShipActionType.Navigate, to);
  public static DockNavigate = (to: string) =>
    new ShipAction(ShipActionType.DockNavigate, to);
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

export const applyShipAction = (
  myShip: Ship,
  sa: ShipAction,
  state: GameState,
  elapsedMs: number,
  ping: number
) => {
  const moveByTime = (SHIP_SPEED * elapsedMs) / 1000;
  const stateConsideringPing = simulateStateUpdate(state, ping) || state;
  const moveByTimeDiagonal = (moveByTime * Math.sqrt(2)) / 2;
  switch (sa.type) {
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
      myShip.rotation = directionToRotation[direction];
      break;
    }
    case ShipActionType.Navigate: {
      let navigate_target = sa.data as IVector;
      myShip.navigate_target = { x: navigate_target.x, y: navigate_target.y };
      break;
    }
    case ShipActionType.DockNavigate: {
      myShip.dock_target = sa.data as string;
      break;
    }
    default:
      console.warn('unknown action', sa);
      break;
  }
  return myShip;
};

let updaterFn:
  | ((serialized_state: string, elapsed_micro: BigInt) => string)
  | undefined = undefined;
(async function () {
  const { update, set_panic_hook } = await import('../../world/pkg');
  updaterFn = update;
  set_panic_hook();
})();

export const simulateStateUpdate = (
  inState: GameState,
  elapsedMs: number
): GameState | undefined => {
  let result;
  try {
    if (updaterFn) {
      let updated = updaterFn(
        JSON.stringify(inState),
        BigInt(elapsedMs * 1000)
      );
      if (updated) {
        result = JSON.parse(updated);
        if (result.message) {
          console.warn(result.message);
          result = undefined;
        }
      } else {
        console.warn('no result from local update');
      }
    } else {
      console.warn('world updater not yet initialized');
    }
  } catch (e) {
    console.warn('error updating state locally', e);
  }
  return result;
};
