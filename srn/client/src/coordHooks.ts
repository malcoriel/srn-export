import { useMemo } from 'react';
import NetState from './NetState';
import {
  calcRealLenToScreenLen,
  calcRealPosToScreenPos,
  calcScreenLenToRealLen,
  calcScreenPosToRealPos,
  viewPortSizeMeters,
  viewPortSizePixels,
} from './coord';

export const useRealToScreen = (ns: NetState) => {
  const { visualState } = ns;

  return useMemo(() => {
    const realLenToScreenLen = calcRealLenToScreenLen(
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.currentZoomShift
    );
    const realPosToScreenPos = calcRealPosToScreenPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.currentZoomShift
    );
    return { realLenToScreenLen, realPosToScreenPos };
  }, [
    visualState.cameraPosition,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    viewPortSizeMeters(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    viewPortSizePixels(),
    visualState.currentZoomShift,
  ]);
};

// noinspection JSUnusedGlobalSymbols
export const useScreenToReal = (ns: NetState) => {
  const { visualState } = ns;

  return useMemo(() => {
    const screenLenToRealLen = calcScreenLenToRealLen(
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.currentZoomShift
    );
    const screenPosToRealPos = calcScreenPosToRealPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.currentZoomShift
    );
    return { screenLenToRealLen, screenPosToRealPos };
  }, [
    visualState.cameraPosition,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    viewPortSizeMeters(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    viewPortSizePixels(),
    visualState.currentZoomShift,
  ]);
};
