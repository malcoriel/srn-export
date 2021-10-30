import Vector, { IVector } from '../utils/Vector';
import { Vector3Arr } from './ThreeLayer';

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
