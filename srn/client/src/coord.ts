import Vector, { IVector } from './utils/Vector';

export const calcScreenPosToRealPos = (
  cameraPosition: IVector,
  viewPortSizeMeters: IVector,
  viewPortSizePixels: IVector,
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

// this essentially locks the system to equal proportions on x, y
// (see length usage)
// although I can't think why would I want them different
export const calcScreenLenToRealLen = (
  viewPortSizeMeters: IVector,
  viewPortSizePixels: IVector,
  zoom: number = 1
) => {
  const meterPerPixel = new Vector(
    viewPortSizeMeters.x / viewPortSizePixels.x,
    viewPortSizeMeters.y / viewPortSizePixels.y
  )
    .scale(1 / zoom)
    .minLen();
  return (valPx: number) => valPx * meterPerPixel;
};

export const calcRealLenToScreenLen = (
  viewPortSizeMeters: IVector,
  viewPortSizePixels: IVector,
  zoom: number = 1
) => {
  const pixelPerMeter = new Vector(
    viewPortSizePixels.x / viewPortSizeMeters.x,
    viewPortSizePixels.y / viewPortSizeMeters.y
  )
    .scale(zoom)
    .minLen();

  return (valMet: number) => valMet * pixelPerMeter;
};

export const calcRealPosToScreenPos = (
  cameraPosition: IVector,
  viewPortSizeMeters: IVector,
  viewPortSizePixels: IVector,
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
export const size = {
  width_px: window.innerWidth,
  height_px: window.innerHeight,
  getMinSize: () => Math.min(size.width_px, size.height_px),
};
export const viewPortSizePixels = () =>
  new Vector(size.width_px, size.height_px);
export let pixels_per_unit = 10;
export const viewPortSizeMeters = () =>
  new Vector(size.width_px / pixels_per_unit, size.height_px / pixels_per_unit);
export const unitsToPixels_x = () => pixels_per_unit;
export const unitsToPixels_y = () => pixels_per_unit;
export const unitsToPixels_min = () =>
  Math.min(unitsToPixels_x(), unitsToPixels_y());
export const radToDeg = (x: number) => (x * 180) / Math.PI;
export const degToRad = (x: number) => (x * Math.PI) / 180;
