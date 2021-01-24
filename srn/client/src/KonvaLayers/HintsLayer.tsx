import NetState, { useNSForceChange } from '../NetState';
import React, { useEffect, useMemo, useState } from 'react';
import { Circle, Layer } from 'react-konva';
import Vector, { VectorF } from '../utils/Vector';
import {
  NatSpawnMineral,
  size,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../world';
import Color from 'color';
import { calcScreenPosToRealPos, calcRealPosToScreenPos } from '../coord';

const MINERAL_OUTLINE_BOOST = 10.0;
let hintFillColor = new Color('pink').alpha(0.2).string();

function MineralHint(m: NatSpawnMineral, pos: Vector) {
  return (
    <Circle
      key={m.id}
      position={pos}
      radius={m.radius * MINERAL_OUTLINE_BOOST}
      fill={hintFillColor}
      stroke="red"
      strokeWidth={1}
    />
  );
}

export const HintsLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('MyTrajectoryLayer', true);
  const { state, visualState } = ns;

  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const { screenToReal, shiftPos } = useMemo(() => {
    //const as = antiScale();
    const shiftPos = calcRealPosToScreenPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels()
    );
    const screenToReal = calcScreenPosToRealPos(
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels()
    );
    return { screenToReal, shiftPos };
  }, [visualState.cameraPosition, zoomProp, size]);

  const [activeHintPos, setActiveHintPos] = useState(VectorF(0, 0));
  useEffect(() => {
    const listener = (ev: any) => {
      let screenPos = new Vector(ev.clientX, ev.clientY);
      const pos = screenToReal(screenPos);
      setActiveHintPos(pos);
    };
    document.addEventListener('mousemove', listener);
    return () => document.removeEventListener('mousemove', listener);
  }, [screenToReal, setActiveHintPos, shiftPos]);

  let position = shiftPos(activeHintPos);
  return (
    <Layer>
      {/*<Circle*/}
      {/*  //key={m.id}*/}
      {/*  position={mousePosition}*/}
      {/*  radius={10}*/}
      {/*  fill="blue"*/}
      {/*  stroke="red"*/}
      {/*  strokeWidth={0.25}*/}
      {/*/>*/}
      <Circle
        //key={m.id}
        position={position}
        radius={10}
        fill={hintFillColor}
        stroke="red"
        strokeWidth={0.25}
      />
    </Layer>
  );
};
