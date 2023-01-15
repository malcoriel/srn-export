/* eslint-disable react/destructuring-assignment */
import React, { useMemo } from 'react';
import { genExplosionSfxPath, ThreeExplosion } from './blocks/ThreeExplosion';
import { useSoundOnMount } from './UseSoundOnMount';
import { ShipShape, ShipShapeProps } from './ShipShape';
import Color from 'color';
import { ThreeExplosionNodeV2 } from './blocks/ThreeExplosionNodeV2';

const sumCharHash = (str: string) => {
  let res = 0;
  for (let i = 0; i < str.length; i++) {
    res += str.charCodeAt(i);
  }
  return res;
};

export type ThreeShipWreckProps = ShipShapeProps & { gid: string };
export const ThreeShipWreck: React.FC<ThreeShipWreckProps> = (props) => {
  const explosionPath = useMemo(() => {
    return genExplosionSfxPath(props.gid + new Date().toString());
  }, [props.gid]);

  const sound = useSoundOnMount({
    path: explosionPath,
    distance: 3,
  });
  return (
    <ShipShape
      fadeOver={3.0}
      {...props}
      color={new Color(props.color).darken(0.5).hex().toString()}
    >
      {sound}
      <ThreeExplosionNodeV2
        seed={sumCharHash(props.gid)}
        scale={props.radius * 1.5}
        blastTime={2.0}
      />
    </ShipShape>
  );
};
