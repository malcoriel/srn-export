const { degToRad, radToDeg } = require('../coord');
const {
  VectorF,
  getCounterClockwiseAngleMath,
  getCounterClockwiseAngleGraphics,
  getRadialDistance,
} = require('./Vector');

const approxN = (c, precision) => Number(c.toPrecision(precision));
const approxEq = (a, b) => expect(approxN(a, 5)).toEqual(approxN(b, 5));

describe('vector', () => {
  it('can turn normalized right dir correctly around zero', () => {
    const right = VectorF(1, 0);
    expect(right.turnCounterClockwise(degToRad(90)).approx(1)).toEqual(
      '0.0/1.0'
    );
    expect(right.turnCounterClockwise(degToRad(-90)).approx(1)).toEqual(
      '0.0/-1.0'
    );
    expect(right.turnCounterClockwise(degToRad(45)).approx(1)).toEqual(
      '0.7/0.7'
    );
    expect(right.turnCounterClockwise(degToRad(-45)).approx(1)).toEqual(
      '0.7/-0.7'
    );
    expect(right.turnCounterClockwise(degToRad(135)).approx(1)).toEqual(
      '-0.7/0.7'
    );
  });

  it('can turn normalized pi/2 correctly around zero', () => {
    const right = VectorF(0.7, 0.7);
    expect(right.turnCounterClockwise(degToRad(90)).approx(1)).toEqual(
      '-0.7/0.7'
    );
    expect(right.turnCounterClockwise(degToRad(135)).approx(1)).toEqual(
      '-1.0/0.0'
    );
  });

  it('can turn non-normalized up correctly', () => {
    const up = VectorF(0, 10);
    expect(up.turnCounterClockwise(degToRad(90)).approx(1)).toEqual(
      '-10.0/0.0'
    );
    expect(up.turnCounterClockwise(degToRad(135)).approx(1)).toEqual(
      '-7.0/-7.0'
    );
  });

  it('can calculate angle between vectors', () => {
    const topMath = VectorF(0, 1);
    const topLeftMath = VectorF(-1, 1);
    const topRightMath = VectorF(1, 1);
    const rightMath = VectorF(1, 0);
    expect(radToDeg(getCounterClockwiseAngleMath(topMath, rightMath))).toEqual(
      270
    );
    approxEq(radToDeg(getCounterClockwiseAngleMath(topMath, topLeftMath)), 45);
    approxEq(
      radToDeg(getCounterClockwiseAngleMath(topMath, topRightMath)),
      315
    );
    expect(
      radToDeg(getCounterClockwiseAngleGraphics(topMath, rightMath))
    ).toEqual(90);
  });

  it('can calculate angle between vectors', () => {
    const top = VectorF(0, -1);
    const left = VectorF(-5, 0);
    const right = VectorF(5, 0);
    expect(radToDeg(getCounterClockwiseAngleGraphics(top, left))).toEqual(90);
    expect(radToDeg(getCounterClockwiseAngleGraphics(top, right))).toEqual(-90);
  });

  it('can calculate distance between angles in radians', () => {
    const ninety = degToRad(90);
    const right = degToRad(0);
    const top = degToRad(90);
    const left = degToRad(180);
    const bottom = degToRad(270);
    expect(getRadialDistance(right, top)).toBeCloseTo(ninety);
    expect(getRadialDistance(top, right)).toBeCloseTo(-ninety); // rotate 90d clockwise
    expect(getRadialDistance(top, bottom)).toBeCloseTo(left); // rotate 180d counter-clockwise (default rotation)
    expect(getRadialDistance(top, bottom + 0.001)).toBeCloseTo(-left + 0.001); // rotate 179deg clockwise
  });
});
