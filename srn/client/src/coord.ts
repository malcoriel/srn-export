import Vector, { IVector, VectorF } from './utils/Vector';

export const calcScreenPosToRealPos = (
  cameraPosition: IVector,
  viewPortSizeMeters: Vector,
  viewPortSizePixels: Vector
) => {
  const cameraShift = Vector.fromIVector(cameraPosition);
  const halfWidthHeight = new Vector(
    viewPortSizePixels.x / 2,
    viewPortSizePixels.y / 2
  );
  const meterPerPixel = new Vector(
    viewPortSizeMeters.x / viewPortSizePixels.x,
    viewPortSizeMeters.y / viewPortSizePixels.y
  );
  return (screenPos: IVector, offsetY = 0) => {
    return Vector.fromIVector(screenPos)
      .subtract(halfWidthHeight)
      .scaleXY(meterPerPixel.x, meterPerPixel.y)
      .add(cameraShift)
      .subtract(VectorF(0, offsetY));
  };
};
