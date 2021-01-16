import Vector, { IVector } from './utils/Vector';

export const size = {
  width_px: window.innerWidth,
  height_px: window.innerHeight,
  getMinSize: () => Math.min(size.width_px, size.height_px),
};

// noinspection JSUnusedGlobalSymbols
export const width_units = 1000;
// noinspection JSUnusedGlobalSymbols
export const height_units = 1000;
export const max_x = width_units / 2;
export const max_y = height_units / 2;
export const min_x = -max_x;
export const min_y = -max_y;
const units_on_screen = 100;

export const unitsToPixels_x = () => size.width_px / units_on_screen;
export const unitsToPixels_y = () => size.height_px / units_on_screen;
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

export const scaleConfig = () => ({
  scaleX: unitsToPixels_min(),
  scaleY: unitsToPixels_min(),
  offsetX: ((-units_on_screen / 2) * unitsToPixels_x()) / unitsToPixels_min(),
  offsetY: ((-units_on_screen / 2) * unitsToPixels_y()) / unitsToPixels_min(),
});

export const antiScale = () => {
  let scaleConfigV = scaleConfig();
  return {
    scaleX: 1 / scaleConfigV.scaleX,
    scaleY: 1 / scaleConfigV.scaleY,
    line: 1 / Math.max(scaleConfigV.scaleX, scaleConfigV.scaleY),
  };
};

export enum ShipActionType {
  Unknown = 'Unknown',
  Move = 'Move',
  Dock = 'Dock',
  Navigate = 'Navigate',
  DockNavigate = 'DockNavigate',
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
      myShip.rotation = directionToRotation[direction];
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
