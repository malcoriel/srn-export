import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial } from 'three';
import { VectorF } from '../utils/Vector';
import * as jellyfish from './shaders/jellyfish';
import { shallowEqual } from '../utils/shallowCompare';
import { ThreeInteractor } from './blocks/ThreeInteractor';
import { vecToThreePos } from './util';
import { ThreeProgressbar } from './blocks/ThreeProgressbar';
import { common, darkGreen } from '../utils/palette';
import { ShipShape, ThreeShipProps } from './ShipShape';
import { ThreeShipTurrets } from './ThreeShipTurrets';

export const BEAM_WIDTH = 0.3;

export const ThreeShip: React.FC<ThreeShipProps> = React.memo(
  ({
    tractorTargetPosition,
    position,
    rotation,
    color,
    visible,
    interactor,
    radius,
    gid,
    opacity,
    hpNormalized,
    tractorBeamWidth = BEAM_WIDTH,
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
        rotation: vector.x < 0 ? angle : -angle,
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
      // if (mainRef.current) {
      //   mainRef.current.userData = mainRef.current.userData || {};
      //   let displayExplosionCalculated = false;
      //   if (blow) {
      //     mainRef.current.userData.blowFrames =
      //       mainRef.current.userData.blowFrames || 0;
      //     mainRef.current.userData.blowFrames += 1;
      //     displayExplosionCalculated =
      //       mainRef.current.userData.blowFrames <= BLOW_FRAMES;
      //   }
      //   if (showExplosion !== displayExplosionCalculated) {
      //     setShowExplosion(displayExplosionCalculated);
      //   }
      // }
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
      <ShipShape {...{ radius, position, rotation, color, opacity }}>
        {healthBar}
        {interactorElem}
        {tractorBeam}
        <ThreeShipTurrets radius={radius} color={color} />
      </ShipShape>
    );
  },
  (prevProps, nextProps) => {
    if (!nextProps.visible) {
      return true;
    }
    return shallowEqual(prevProps, nextProps);
  }
);
