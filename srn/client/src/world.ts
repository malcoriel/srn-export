export const width_px = 800;
export const height_px = 800;
export const width_units = 100;
export const height_units = 100;
export const max_x = 50;
export const max_y = 50;
export const min_x = -50;
export const min_y = -50;

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

export type Vec2f64 = {
  x: number;
  y: number;
};

export type GameObject = WithId &
  Vec2f64 & {
    rotation: number;
    radius: number;
  };

export type Planet = GameObject & WithName & WithColor;
export type Star = GameObject & WithName & WithColor;

export type Ship = GameObject & WithColor;

export type Player = WithId & {
  ship_id?: string;
  name: string;
};

export type GameState = {
  planets: Planet[];
  ships: Ship[];
  players: Player[];
  tick: number;
  my_id: string;
  star: Star;
};

export const scaleConfig = {
  scaleX: 8,
  scaleY: 8,
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

enum ShipActionType {
  Unknown,
  Move,
  Dock,
}

export enum Direction {
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
}

export const applyShipAction = (
  myShip: Ship,
  sa: ShipAction,
  state: GameState
) => {
  switch (sa.type) {
    case ShipActionType.Dock: {
      break;
    }
    case ShipActionType.Move: {
      switch (sa.data as Direction) {
        case Direction.Up:
          myShip.y -= 1;
          break;
        case Direction.UpRight:
          myShip.x += 1;
          myShip.y -= 1;
          break;
        case Direction.Right:
          myShip.x += 1;
          break;
        case Direction.DownRight:
          myShip.y += 1;
          myShip.x += 1;
          break;
        case Direction.Down:
          myShip.y += 1;
          break;
        case Direction.DownLeft:
          myShip.y += 1;
          myShip.x -= 1;
          break;
        case Direction.Left:
          myShip.x -= 1;
          break;
        case Direction.UpLeft:
          myShip.y -= 1;
          myShip.x -= 1;
          break;
      }
      break;
    }
    default:
      // intentional pass-through
      break;
  }
  return myShip;
};
