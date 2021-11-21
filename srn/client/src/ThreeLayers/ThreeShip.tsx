import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Group, Mesh, ShaderMaterial } from 'three';
import * as THREE from 'three';
import Vector, { VectorF } from '../utils/Vector';
import * as jellyfish from './shaders/jellyfish';
import { shallowEqual } from '../utils/shallowCompare';
import { Geometry } from 'three/examples/jsm/deprecated/Geometry';
import {
  ThreeInteractor,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import { posToThreePos, Vector3Arr, vecToThreePos } from './util';
import { ThreeProgressbar } from './blocks/ThreeProgressbar';
import { common, darkGreen, mint } from '../utils/palette';
import { ThreeExplosion } from './blocks/ThreeExplosion';
import Color from 'color';

const STLLoader = require('three-stl-loader')(THREE);

type ThreeShipProps = {
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
};

const BEAM_WIDTH = 0.3;
// ships are always 'above' the stuff
const SHIP_FIXED_Z = 50;

export const ThreeShipBase = () => {
  return null;
};

type ShipShapeProps = {
  radius: number;
  position: Vector;
  rotation: number;
  color: string;
  opacity: number;
};
const ShipShape: React.FC<ShipShapeProps> = ({
  radius,
  position,
  rotation,
  color,
  opacity,
  children,
}) => {
  // @ts-ignore
  const shipModel = useLoader<Geometry>(STLLoader, 'resources/models/ship.stl');

  const memoScale = useMemo(
    () => [0.15, 0.2, 0.25].map((v: number) => v * radius) as Vector3Arr,
    [radius]
  );

  return (
    <group position={posToThreePos(position.x, position.y, SHIP_FIXED_Z)}>
      <mesh
        position={[0, 0, 0]}
        scale={memoScale}
        rotation={[Math.PI, 0, rotation]}
        // @ts-ignore
        geometry={shipModel}
      >
        <meshBasicMaterial color={color} opacity={opacity} transparent />
      </mesh>
      {children}
    </group>
  );
};

export type ThreeShipHuskProps = ShipShapeProps & { gid: string };

export const ThreeShipWreck: React.FC<ThreeShipHuskProps> = React.memo(
  (props) => {
    return (
      <ShipShape
        {...props}
        color={new Color(props.color).darken(0.5).toString()}
      >
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
