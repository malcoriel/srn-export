import React from 'react';
import { LocalEffect } from '../../../world/pkg/world';
import { posToThreePos, vecToThreePos } from './util';
import { teal } from '../utils/palette';
import { Text } from '@react-three/drei';

export const ThreeVisualEffect: React.FC<{ effect: LocalEffect }> = ({
  effect,
}) => {
  if (effect.tag === 'Unknown') {
    return null;
  }
  // @ts-ignore
  const text = effect.hp ? effect.hp : effect.text;
  return (
    <Text
      visible
      color={teal}
      font="resources/fonts/DejaVuSans.ttf"
      fontSize={1.0}
      maxWidth={20}
      lineHeight={1}
      letterSpacing={0.02}
      textAlign="center"
      anchorX="center"
      anchorY="middle"
    >
      {text}
    </Text>
  );
};
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
            <ThreeVisualEffect effect={e} />
          </group>
        );
      })}
    </>
  );
};
