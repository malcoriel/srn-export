import NetState, { useNSForceChange } from '../NetState';
import React, { useEffect, useMemo, useState } from 'react';
import { Circle, Layer } from 'react-konva';
import Vector, { IVector, VectorF } from '../utils/Vector';
import { calcShiftPos, halfWidthHeight } from './OverObjectLayer';
import { antiScale, NatSpawnMineral } from '../world';
import Color from 'color';
import { calcScreenPosToRealPos } from '../coord';

const MINERAL_OUTLINE_BOOST = 10.0;
let hintFillColor = new Color('pink').alpha(0.2).string();

function MineralHint(
  m: NatSpawnMineral,
  shiftPos: (objPos: IVector, offsetY?: number) => Vector,
  pos: Vector,
  as: { scaleX: number; scaleY: number; line: number }
) {
  return (
    <Circle
      key={m.id}
      position={shiftPos(pos)}
      radius={m.radius * MINERAL_OUTLINE_BOOST * as.line}
      fill={hintFillColor}
      stroke="red"
      strokeWidth={0.25}
    />
  );
}

export const HintsLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('MyTrajectoryLayer', true);
  const { state, visualState } = ns;

  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const { shiftPos, as, antiShiftPos } = useMemo(() => {
    const as = antiScale();
    const shiftPos = calcShiftPos(visualState.cameraPosition, zoomProp);
    const antiShiftPos = calcScreenPosToRealPos(
      visualState.cameraPosition,
      zoomProp
    );
    return { shiftPos, as, antiShiftPos };
  }, [visualState.cameraPosition, zoomProp]);

  const [activeHintPos, setActiveHintPos] = useState(VectorF(0, 0));
  useEffect(() => {
    const listener = (ev: any) => {
      // console.log(ev);
      let screenPos = new Vector(ev.clientX, ev.clientY);
      // console.log(Vector.fromIVector(screenPos).subtract(halfWidthHeight));
      const pos = antiShiftPos(screenPos);
      setActiveHintPos(pos);
    };
    document.addEventListener('mousemove', listener);
    return () => document.removeEventListener('mousemove', listener);
  }, [antiShiftPos, setActiveHintPos]);

  return (
    <Layer>
      {/*<Circle*/}
      {/*  //key={m.id}*/}
      {/*  position={shiftPos(activeHintPos)}*/}
      {/*  radius={5}*/}
      {/*  fill={hintFillColor}*/}
      {/*  stroke="red"*/}
      {/*  strokeWidth={0.25}*/}
      {/*/>*/}
    </Layer>
  );
};
