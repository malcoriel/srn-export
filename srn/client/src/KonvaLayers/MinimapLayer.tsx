import React, { useState } from 'react';
import NetState from '../NetState';
import { Layer, Rect, Text } from 'react-konva';
import { height_units, width_px, width_units } from '../world';
import { blue, gray, yellow } from '../utils/palette';
import Vector, { VectorF } from '../utils/Vector';
export const minimap_size = width_px * 0.3;
export const minimap_scale = 0.1;
export const minimap_viewport_size = minimap_size * minimap_scale;
export const minimap_shift = 0.005;

export const MinimapLayer = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  let { cameraPosition } = visualState;
  let cameraPositionUV = Vector.fromIVector({
    x: cameraPosition.x / width_units + 0.5 - minimap_scale / 2,
    y: cameraPosition.y / height_units + 0.5 - minimap_scale / 2,
  });
  // for some mystic reason, having setDragPosition forces synchronization
  const [dragPosition, setDragPosition] = useState(cameraPositionUV);
  return (
    <Layer>
      <Rect
        width={minimap_viewport_size}
        height={minimap_viewport_size}
        fill={yellow}
        opacity={0.6}
        draggable
        onDragMove={(dragEvent) => {
          const mouseEvent = dragEvent.evt as any;
          let currentPosition = new Vector(
            mouseEvent.layerX,
            mouseEvent.layerY
          );
          visualState.boundCameraMovement = false;
          let currentPositionUV = new Vector(
            currentPosition.x / minimap_size - 0.5,
            currentPosition.y / minimap_size - 0.5
          );
          setDragPosition(currentPositionUV);
          visualState.cameraPosition = currentPositionUV.scale(width_units);
        }}
        position={cameraPositionUV.scale(minimap_size)}
      />
    </Layer>
  );
};
