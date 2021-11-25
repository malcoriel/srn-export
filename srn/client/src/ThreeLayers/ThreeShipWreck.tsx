import React, { useMemo } from 'react';
import { genExplosionSfxPath, ThreeExplosion } from './blocks/ThreeExplosion';
import { useSoundOnMount } from './UseSoundOnMount';
import { ShipShape, ShipShapeProps } from './ShipShape';
import Color from 'color';

export type ThreeShipWreckProps = ShipShapeProps & { gid: string };
export const ThreeShipWreck: React.FC<ThreeShipWreckProps> = React.memo(
  (props) => {
    const explosionPath = useMemo(() => {
      return genExplosionSfxPath(props.gid + new Date().toString());
    }, [props.gid]);

    const sound = useSoundOnMount({
      path: explosionPath,
      distance: 3,
    });
    return (
      <ShipShape
        {...props}
        color={new Color(props.color).darken(0.5).hex().toString()}
      >
        {sound}
        <ThreeExplosion
          seed={props.gid}
          position={[0, 0, props.radius + 10]}
          radius={props.radius * 1.5}
          explosionTimeSeconds={2.0}
          autoPlay
          playOnce
        />
      </ShipShape>
    );
  }
);
