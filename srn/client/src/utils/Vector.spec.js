const { degToRad } = require('../coord');
const { VectorF } = require('./Vector');
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
});
