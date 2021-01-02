import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Stage } from 'react-konva';
import {
  get_minimap_size_x,
  get_minimap_size_y,
  MinimapLayer,
} from './MinimapLayer';
import { blue } from '../utils/palette';
import React from 'react';

export const MinimapLayerWrapper = () => {
  const shown = useToggleHotkey('shift+m', true, 'show minimap');
  if (!shown) return null;

  return (
    <Stage
      width={get_minimap_size_x()}
      height={get_minimap_size_y()}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        border: `solid ${blue} 1px`,
        borderRadius: 5,
      }}
    >
      <MinimapLayer />
    </Stage>
  );
};
