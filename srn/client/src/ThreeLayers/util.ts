import Vector, { IVector } from '../utils/Vector';

export type Vector3Arr = [number, number, number];
export const vecToThreePos = (v: IVector, lift = 0): Vector3Arr => [
  v.x,
  -v.y,
  lift,
];

// noinspection JSUnusedGlobalSymbols
export const threePosToVector = (x: number, y: number, _z: number): Vector =>
  new Vector(x, -y);

// noinspection JSUnusedLocalSymbols
export const threeVectorToVector = ({
  x,
  y,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  z,
}: {
  x: number;
  y: number;
  z: number;
}): Vector => new Vector(x, -y);

export const liftThreePos = (zShift: number) => (
  threeArrVec: [number, number, number]
): [number, number, number] => [
  threeArrVec[0],
  threeArrVec[1],
  threeArrVec[2] + zShift,
];
export const seedToNumber = (seed: string) => {
  try {
    return Number(`0x${seed}`) || 0;
  } catch (e) {
    return 0;
  }
}; // x -> x, y -> -y to keep the axes orientation corresponding to the physics  (y down),
// xy is visible plane, z towards camera
export const posToThreePos = (x: number, y: number, z?: number): Vector3Arr => [
  x,
  -y,
  z || 0,
];
