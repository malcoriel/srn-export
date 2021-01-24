import { useMemo } from 'react';
import NetState from './NetState';
import {
  calcRealLenToScreenLen,
  calcRealPosToScreenPos,
  calcScreenLenToRealLen,
  calcScreenPosToRealPos,
} from './coord';
import { viewPortSizeMeters, viewPortSizePixels } from './world';

export const useRealToScreen = (ns: NetState) => {
  const { visualState } = ns;

  return useMemo(() => {
    const realLenToScreenLen = calcRealLenToScreenLen(
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift
    );
    const realPosToScreenPos = calcRealPosToScreenPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift
    );
    return { realLenToScreenLen, realPosToScreenPos };
  }, [
    visualState.cameraPosition,
    viewPortSizeMeters(),
    viewPortSizePixels(),
    visualState.zoomShift,
  ]);
};

export const useScreenToReal = (ns: NetState) => {
  const { visualState } = ns;

  return useMemo(() => {
    const screenLenToRealLen = calcScreenLenToRealLen(
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift
    );
    const screenPosToRealPos = calcScreenPosToRealPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift
    );
    return { screenLenToRealLen, screenPosToRealPos };
  }, [
    visualState.cameraPosition,
    viewPortSizeMeters(),
    viewPortSizePixels(),
    visualState.zoomShift,
  ]);
};
