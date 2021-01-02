import React from 'react';
import NetState from '../NetState';
import { Layer, Rect } from 'react-konva';
import {
  antiScale,
  height_units,
  view_size,
  width_px,
  width_units,
} from '../world';
import { blue, gray } from '../utils/palette';
import Vector from '../utils/Vector';
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
  }); //.add(new Vector(minimap_size / 2, minimap_size / 2));
  return (
    <Layer>
      <Rect
        width={minimap_viewport_size}
        height={minimap_viewport_size}
        strokeWidth={2}
        stroke={blue}
        fill={gray}
        opacity={0.8}
        draggable
        onDragMove={(evt) => {
          let currentPositionUv = evt.target.position();
        }}
        position={cameraPositionUV.scale(minimap_size)}
      />
    </Layer>
  );
};
