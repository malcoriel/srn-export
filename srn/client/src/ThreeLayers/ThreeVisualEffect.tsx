import React, { useRef } from 'react';
import { Text } from '@react-three/drei';
import { crimson, darkGreen, teal } from '../utils/palette';
import { LocalEffect } from '../../../world/pkg/world';
import { useFrame } from '@react-three/fiber';
import { Group } from 'three';

import { lerp } from '../world';
import _ from 'lodash';

export type ThreeVisualEffectProps = {
  effect: LocalEffect;
  effectTimeSeconds: number;
  textEffectTimeSeconds: number;
};

const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*@#$%^&*@#$%^&*@#$%^&*@#$%^&*@#$%^&*()-_+=[]{};:|,.<>/?`~1234567890';

const fillRandom = (len: number) => {
  let res = '';
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * alphabet.length) % alphabet.length;
    res += alphabet[idx];
  }
  return res;
};

const trueInterpolateText = (from: string, to: string, animation: number) => {
  const curLength = Math.round(lerp(from.length, to.length, animation));
  if (curLength === from.length) {
    return from;
  }
  if (curLength === to.length) {
    return to;
  }
  return fillRandom(curLength);
};

const interpolateText = (
  fromText: string | number,
  toText: string | number,
  textAnimation: number
) => {
  if (typeof fromText === 'string' || typeof toText === 'string') {
    return trueInterpolateText(String(fromText), String(toText), textAnimation);
  }
  const fromNumber = fromText as number;
  const toNumber = toText as number;
  return Math.round(lerp(fromNumber, toNumber, textAnimation));
};

const effectColor: Record<LocalEffect['tag'], string> = {
  Unknown: teal,
  DmgDone: crimson,
  Heal: darkGreen,
  PickUp: teal,
};

export const ThreeVisualEffect: React.FC<ThreeVisualEffectProps> = ({
  effect,
  effectTimeSeconds,
  textEffectTimeSeconds,
}) => {
  if (effect.tag === 'Unknown') {
    return null;
  }

  const groupRef = useRef<Group>();
  const textRef = useRef<Text>();
  // Old version: https://www.math3d.org/35iChbWuo
  // Easing function used for the fading out and scaling out: https://www.math3d.org/ZMDUoq8Jt
  // the effective maximum of a function is achieved around 40%, so e.g. 10 seconds means 4 seconds to peak, then fade over 6
  useFrame((_unused, deltaS) => {
    if (groupRef.current && textRef.current) {
      const diffAnimation = deltaS / effectTimeSeconds;
      const diffTextAnimation = deltaS / textEffectTimeSeconds;
      const data = groupRef.current.userData;
      data.animation = data.animation || 0;
      data.animation += diffAnimation;
      data.textAnimation = data.textAnimation || 0;
      data.textAnimation += diffTextAnimation;
      if (data.textAnimation > 1) {
        data.textAnimation = 1;
      }
      if (data.animation > 1) {
        data.animation = 1;
      }
      const tNorm = data.animation;
      // eslint-disable-next-line no-restricted-properties
      const scale = Math.pow(2, -3 * tNorm) * Math.sin(3 * tNorm) * 2.1;
      groupRef.current.scale.set(scale, scale, scale);
      // downcast is safe because of static children, and Text TS typing is so useless that it's better to use any
      const textChild = groupRef.current.children[0] as any;
      textChild.material.opacity = scale;
      // @ts-ignore
      const currentExternalText = effect.hp ? effect.hp : effect.text;

      if (currentExternalText && data.toText !== currentExternalText) {
        if (data.fromText) {
          // console.log(
          //   `target change from ${
          //     data.toText
          //   } to ${currentExternalText} ${typeof currentExternalText}`
          // );
          data.textAnimation = 0;
          data.fromText = data.text;
          if (!_.isNaN(Number(data.fromText))) {
            data.fromText = Number(data.fromText);
          }
          data.toText = currentExternalText;
          data.animation = 0.25; // reset the main animation on slightly below peak to show the change
        } else {
          data.toText = currentExternalText;
          // console.log(
          //   `initial set to ${
          //     data.toText
          //   } ${typeof data.toText} ${typeof data.toText}`
          // );
          // initial first transition
          data.fromText = data.toText;
        }
      }

      if (data.textAnimation <= 1) {
        data.text = interpolateText(
          data.fromText,
          data.toText,
          data.textAnimation
        );

        textChild.text = data.text;
      }
    }
  });
  // @ts-ignore
  return (
    <group ref={groupRef}>
      <Text
        ref={textRef}
        visible
        color={effectColor[effect.tag]}
        font="resources/fonts/DejaVuSans.ttf"
        fontSize={2.0}
        maxWidth={20}
        lineHeight={1}
        letterSpacing={0.02}
        textAlign="center"
        anchorX="center"
        anchorY="middle"
      >
        {}
      </Text>
    </group>
  );
};
