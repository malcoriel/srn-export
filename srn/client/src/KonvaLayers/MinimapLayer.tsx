import React from 'react';
import NetState from '../NetState';
import { Layer, Rect } from 'react-konva';
import { antiScale, height_units, view_size, width_units } from '../world';
import { blue, gray } from '../utils/palette';
import Vector from '../utils/Vector';
export const MinimapLayer = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  let minimap_size = 30;
  let minimap_scale = 0.1;
  let minimap_viewport_size = minimap_size * minimap_scale;
  let minimap_shift = 0.005;
  let { cameraPosition } = visualState;
  let cameraPositionUV = Vector.fromIVector({
    x: cameraPosition.x / width_units + 0.5 - minimap_scale / 2,
    y: cameraPosition.y / height_units + 0.5 - minimap_scale / 2,
  }); //.add(new Vector(minimap_size / 2, minimap_size / 2));
  let minimap_position = Vector.fromIVector({
    y: -view_size / 2 + minimap_shift,
    x: -minimap_shift + view_size / 2 - minimap_size,
  });
  return (
    <Layer>
      <Rect
        fill={gray}
        cornerRadius={1}
        opacity={0.5}
        width={minimap_size}
        height={minimap_size}
        position={minimap_position}
        strokeWidth={1.01 * antiScale.line}
        stroke={blue}
      />
      <Rect
        width={minimap_viewport_size}
        height={minimap_viewport_size}
        strokeWidth={1.01 * antiScale.line}
        stroke={blue}
        position={cameraPositionUV.scale(minimap_size).add(minimap_position)}
      />
    </Layer>
  );
};
