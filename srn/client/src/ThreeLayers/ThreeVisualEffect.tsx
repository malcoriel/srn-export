import React from 'react';
import { Text } from '@react-three/drei';
import { teal } from '../utils/palette';
import { LocalEffect } from '../../../world/pkg/world';

export type ThreeVisualEffectProps = { effect: LocalEffect };
export const ThreeVisualEffect: React.FC<ThreeVisualEffectProps> = ({
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
