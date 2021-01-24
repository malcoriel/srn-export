import Vector, { IVector, VectorF } from './utils/Vector';

export const calcScreenPosToRealPos = (
  cameraPosition: IVector,
  viewPortSizeMeters: Vector,
  viewPortSizePixels: Vector,
  zoom: number = 1
) => {
  const cameraShift = Vector.fromIVector(cameraPosition);
  const halfWidthHeight = new Vector(
    viewPortSizePixels.x / 2,
    viewPortSizePixels.y / 2
  );
  const meterPerPixel = new Vector(
    viewPortSizeMeters.x / viewPortSizePixels.x,
    viewPortSizeMeters.y / viewPortSizePixels.y
  ).scale(1 / zoom);
  return (screenPos: IVector) => {
    return Vector.fromIVector(screenPos)
      .subtract(halfWidthHeight)
      .scaleXY(meterPerPixel.x, meterPerPixel.y)
      .add(cameraShift);
  };
};

export const calcRealPosToScreenPos = (
  cameraPosition: IVector,
  viewPortSizeMeters: Vector,
  viewPortSizePixels: Vector,
  zoom: number = 1
) => {
  const cameraShift = Vector.fromIVector(cameraPosition);
  const pixelPerMeter = new Vector(
    viewPortSizePixels.x / viewPortSizeMeters.x,
    viewPortSizePixels.y / viewPortSizeMeters.y
  ).scale(zoom);

  const halfWidthHeight = new Vector(
    viewPortSizePixels.x / 2,
    viewPortSizePixels.y / 2
  );

  return (objPos: IVector) => {
    return Vector.fromIVector(objPos)
      .subtract(cameraShift)
      .scaleXY(pixelPerMeter.x, pixelPerMeter.y)
      .add(halfWidthHeight);
  };
};
