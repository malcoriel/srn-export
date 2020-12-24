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

export type WithId = {
  id: number;
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

export type Planet = GameObject;

export type Ship = GameObject;

export type GameState = {
  planets: Planet[];
  ships: Ship[];
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
