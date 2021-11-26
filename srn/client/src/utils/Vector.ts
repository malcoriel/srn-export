export interface IVector {
  x: number;
  y: number;
}

export default class Vector implements IVector {
  constructor(public x: number, public y: number) {}

  toKey(separator = '/', fix?: number) {
    const xVal = fix !== undefined ? this.x.toFixed(fix) : this.x;
    const yVal = fix !== undefined ? this.y.toFixed(fix) : this.y;
    return `${xVal}${separator}${yVal}`;
  }

  static fromIVector(from: IVector) {
    return new Vector(from.x, from.y);
  }

  static fromKey(target: string, separator = '/'): Vector {
    const parts = target.split(separator);
    if (parts.length !== 2) {
      return new Vector(0, 0);
    }
    const x = Number(parts[0]) || 0;
    const y = Number(parts[1]) || 0;
    return new Vector(x, y);
  }

  toFix(fix = 2) {
    return this.toKey(undefined, fix);
  }

  add(other: Vector) {
    return new Vector(this.x + other.x, this.y + other.y);
  }

  equals(other: Vector | null) {
    if (!other) return false;
    return other.x === this.x && other.y === this.y;
  }

  static equals(
    that: IVector | null | undefined,
    other: IVector | null | undefined
  ) {
    if (!other && !that) return true;
    if (!other && that) return false;
    if (other && !that) return false;

    return other!.x === that!.x && other!.y === that!.y;
  }

  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  minLen() {
    return Math.min(this.lengthX(), this.lengthY());
  }

  // noinspection JSUnusedGlobalSymbols
  lengthY() {
    return Math.abs(this.y);
  }

  // noinspection JSUnusedGlobalSymbols
  lengthX() {
    return Math.abs(this.x);
  }

  clone() {
    return new Vector(this.x, this.y);
  }

  subtract(other: Vector) {
    return new Vector(this.x - other.x, this.y - other.y);
  }

  // noinspection JSUnusedGlobalSymbols
  turnOn(angle: number) {
    const newX = this.x * Math.cos(angle) - this.y * Math.sin(angle);
    const newY = this.x * Math.sin(angle) + this.y * Math.cos(angle);
    return new Vector(newX, newY);
  }

  // noinspection JSUnusedGlobalSymbols
  euDistTo(other: Vector): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  manDistTo(other: Vector): number {
    const dx = Math.abs(this.x - other.x);
    const dy = Math.abs(this.y - other.y);
    return dx + dy;
  }

  maxDistTo(other: Vector): number {
    const dx = Math.abs(this.x - other.x);
    const dy = Math.abs(this.y - other.y);
    return Math.max(dx, dy);
  }

  // noinspection JSUnusedGlobalSymbols
  cycleManDistTo(other: Vector, width: number, height: number): number {
    const dxEq = Math.abs(this.x - other.x);
    const dxPlus = Math.abs(this.x - other.x + width);
    const dxMinus = Math.abs(this.x - other.x - width);
    const dx = Math.min(dxEq, Math.min(dxPlus, dxMinus));

    const dyEq = Math.abs(this.y - other.y);
    const dyPlus = Math.abs(this.y - other.y + height);
    const dyMinus = Math.abs(this.y - other.y - height);
    const dy = Math.min(dyEq, Math.min(dyPlus, dyMinus));
    return dx + dy;
  }

  // the coordinates are mathematical, y pointing up, x pointing right
  turnCounterClockwise(angle: number) {
    const { x, y } = this;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const xRotated = x * cos - y * sin;
    const yRotated = x * sin + y * cos;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return VectorF(xRotated, yRotated);
  }

  scalarMultiply(b: Vector) {
    const a = this;
    return a.x * b.x + a.y * b.y;
  }

  /*
   * @deprecated
   * */
  angleRad(b: Vector): number {
    return Math.acos(this.scalarMultiply(b) / this.length() / b.length());
  }

  // noinspection JSUnusedGlobalSymbols
  leftDownLess(right: Vector) {
    if (this.y < right.y) {
      return true;
    }
    return this.x < right.x;
  }

  scale(number: number) {
    return new Vector(this.x * number, this.y * number);
  }

  scaleXY(xScale: number, yScale: number) {
    return new Vector(this.x * xScale, this.y * yScale);
  }

  // noinspection JSUnusedGlobalSymbols
  isCloseToAny(targets: Vector[], minDist: number) {
    for (const t of targets) {
      if (t.manDistTo(this) < minDist) {
        return true;
      }
    }
    return false;
  }

  normalize() {
    return this.scale(1 / this.length());
  }

  map(fn: (c: number) => number) {
    return new Vector(fn(this.x), fn(this.y));
  }

  approx(precision: number) {
    return this.map((c) => Number(c.toPrecision(precision))).toFix(precision);
  }
}

const memory = new Map();
// noinspection TsLint
export function VectorF(x: number, y: number) {
  const key = `${x}/${y}`;
  const ex = memory.get(key);
  if (ex) {
    return ex;
  }
  const vector = new Vector(x, y);
  memory.set(key, vector);
  Object.freeze(vector);
  return vector;
}

// eslint-disable-next-line camelcase
export const VectorFzero = VectorF(0, 0);

// noinspection JSUnusedGlobalSymbols
export function VectorFK(key: string) {
  const [x, y] = key.split('/').map(Number);
  return VectorF(x, y);
}

// noinspection JSUnusedGlobalSymbols
export type Rect = {
  width: number;
  height: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const radToDeg = (r: number): number => {
  return (r * 180) / Math.PI;
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const degToRad = (r: number): number => {
  return (r / 180) * Math.PI;
};

export const isIVector = (smth: any): smth is IVector => {
  return typeof smth.x === 'number' && typeof smth.y === 'number';
};

// assuming Y is pointing up and X right,
// what angle do we need counterclockwise to turn from a to b ?
export const getCounterClockwiseAngleMath = (a: Vector, b: Vector): number => {
  const cos = a.scalarMultiply(b) / a.length() / b.length();
  let angle = Math.acos(cos);
  const cross_product = a.x * b.y - a.y * b.x;

  const sin = cross_product / a.length() / b.length();
  if (sin < 0) angle = Math.PI * 2 - angle;
  return angle;
};

// assuming Y is pointing down and X right,
// what angle do we need counterclockwise to turn from a to b ?
export const getCounterClockwiseAngleGraphics = (
  a: Vector,
  b: Vector
): number => {
  const cos = a.scalarMultiply(b) / a.length() / b.length();
  let angle = Math.acos(cos);
  const cross_product = a.x * b.y + a.y * b.x;

  const sin = cross_product / a.length() / b.length();
  if (sin < 0) angle = -angle;
  return angle;
};
