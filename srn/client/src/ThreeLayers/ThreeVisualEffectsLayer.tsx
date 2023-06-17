import React from 'react';
import { LocalEffect } from '../../../world/pkg/world';
import { posToThreePos } from './util';
import { ThreeVisualEffect } from './ThreeVisualEffect';

export const ThreeVisualEffectsLayer: React.FC<{
  effects: LocalEffect[];
}> = ({ effects }) => {
  return (
    <>
      {effects.map((e) => {
        if (e.tag === 'Unknown') {
          return null;
        }
        return (
          <group
            key={e.key}
            position={posToThreePos(e.position.x, e.position.y)}
          >
            <ThreeVisualEffect
              effect={e}
              effectTimeSeconds={3}
              textEffectTimeSeconds={0.25}
            />
          </group>
        );
      })}
    </>
  );
};
