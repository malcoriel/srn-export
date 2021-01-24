import { useMemo } from 'react';
import NetState from './NetState';
import { calcRealPosToScreenPos } from './coord';
import { viewPortSizeMeters, viewPortSizePixels } from './world';

export const useRealToScreen = (ns: NetState) => {
  const { visualState } = ns;

  return useMemo(
    () =>
      calcRealPosToScreenPos(
        visualState.cameraPosition,
        viewPortSizeMeters(),
        viewPortSizePixels(),
        visualState.zoomShift
      ),
    [
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift,
    ]
  );
};
