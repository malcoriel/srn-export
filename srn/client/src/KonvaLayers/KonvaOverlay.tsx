import React from 'react';
import { Circle, Layer, Text } from 'react-konva';
import Prando from 'prando';
import { GameState, TRACTOR_DIST } from '../world';
import NetState from '../NetState';
import Vector, { IVector } from '../utils/Vector';
import { crimson, darkGreen, rare, teal } from '../utils/palette';
import { useStore } from '../store';
import { useRealToScreen } from '../coordHooks';
import { UnreachableCaseError } from 'ts-essentials';
import { findMyShip } from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';

type VisLocalEffect = {
  id: string;
  text: string;
  opacity: number;
  color: string;
  position: IVector;
  offset: IVector;
};

export const KonvaOverlay: React.FC = React.memo(() => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('KonvaOverlay', true);
  const showTractorCircle = useStore((state) => state.showTractorCircle);

  const { state } = ns;
  const myShip = findMyShip(state);

  const { realLenToScreenLen, realPosToScreenPos } = useRealToScreen(ns);

  const tractorDistanceCircle = myShip && (
    <Circle
      radius={realLenToScreenLen(TRACTOR_DIST)}
      stroke={teal}
      strokeWidth={1}
      position={realPosToScreenPos(myShip.spatial.position)}
      dash={[5, 10]}
    />
  );
  return <Layer>{showTractorCircle && <>{tractorDistanceCircle}</>}</Layer>;
});
