import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial } from 'three';
import Vector, { VectorF, VectorFZero } from '../utils/Vector';
import * as jellyfish from './shaders/jellyfish';
import { shallowEqual } from '../utils/shallowCompare';
import {
  ThreeInteractor,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import { vecToThreePos } from './util';
import { ThreeProgressbar } from './blocks/ThreeProgressbar';
import { common, darkGreen } from '../utils/palette';
import { ShipShape } from './ShipShape';
import { ThreeShipTurrets, TurretProps } from './ThreeShipTurrets';
import { LongAction } from '../../../world/pkg';
import Color from 'color';
import { MovementMarkers } from './ThreeProjectilesLayer';

export const BEAM_WIDTH = 0.3;

export type ThreeShipProps = {
  gid: string;
  position: Vector;
  tractorTargetPosition?: Vector;
  color: string;
  rotation: number;
  radius: number;
  visible: boolean;
  tractorBeamWidth?: number;
  opacity: number;
  hpNormalized: number;
  interactor?: ThreeInteractorProps;
  longActions?: LongAction[];
  turrets?: TurretProps[];
  markers?: string;
  findObjectPositionByIdBound?: (id: string | number) => Vector | null;
};

export const ThreeShip: React.FC<ThreeShipProps> = React.memo(
  ({
    tractorTargetPosition,
    position,
    rotation,
    color,
    visible = true,
    interactor,
    radius,
    gid,
    opacity,
    hpNormalized,
    tractorBeamWidth = BEAM_WIDTH,
    longActions = [],
    turrets = [],
    markers,
    findObjectPositionByIdBound = () => null,
  }) => {
    const tractorRef = useRef<Mesh>();
    const tractorBeamParams = useMemo(() => {
      if (!tractorTargetPosition) {
        return null;
      }
      const vector = tractorTargetPosition.subtract(position);
      const angle = VectorF(0, 1).angleRad(vector);
      return {
        length: vector.length(),
        rotation: -angle,
        position: vecToThreePos(vector.scale(0.5)),
        patchedUniforms: {
          ...jellyfish.uniforms,
        },
      };
    }, [tractorTargetPosition, position]);

    useFrame(() => {
      if (tractorRef.current && visible) {
        const material = tractorRef.current.material as ShaderMaterial;
        if (material && material.uniforms) {
          material.uniforms.time.value += 0.004;
        }
      }
    });

    const tractorBeam = (
      <>
        {tractorBeamParams && (
          <mesh
            ref={tractorRef}
            position={tractorBeamParams.position}
            rotation={[0, 0, -tractorBeamParams.rotation]}
          >
            <cylinderBufferGeometry
              args={[
                tractorBeamWidth,
                tractorBeamWidth,
                tractorBeamParams.length,
                4,
              ]}
            />
            <rawShaderMaterial
              transparent
              {...jellyfish}
              // uniforms={tractorBeamParams.patchedUniforms}
            />
          </mesh>
        )}
      </>
    );
    const healthBar = (
      <ThreeProgressbar
        position={[0, -radius - 1.0, 0]}
        length={radius * 2}
        girth={radius / 5}
        completionNormalized={hpNormalized}
        fillColor={darkGreen}
        backgroundColor={common}
        hideWhenFull
      />
    );
    const interactorElem = (
      <>
        {interactor && (
          <ThreeInteractor
            perfId={`ship-${gid}`}
            objectId={gid}
            radius={radius}
            interactor={interactor}
          />
        )}
      </>
    );

    return (
      <ShipShape
        {...{ radius, position, rotation, color, opacity, gid, visible }}
      >
        {healthBar}
        {interactorElem}
        {tractorBeam}
        <ThreeShipTurrets
          position={[0, 0, 10]}
          positionRadius={radius / 1.9}
          ownRadius={radius / 7.0}
          color={new Color(color).lighten(0.5).hex().toString()}
          beamWidth={radius / 20.0}
          longActions={longActions}
          findObjectPositionByIdBound={findObjectPositionByIdBound}
          rotation={rotation}
          turrets={turrets}
          parentPosition={[-position.x, position.y, 0]}
        />
        {markers && (
          <MovementMarkers
            markers={markers}
            position={VectorFZero}
            velocity={VectorFZero}
            radius={radius}
          />
        )}
      </ShipShape>
    );
  },
  (prevProps, nextProps) => {
    if (!nextProps.visible && !prevProps.visible) {
      return true;
    }
    return shallowEqual(prevProps, nextProps);
  }
);
