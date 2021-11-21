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

const STLLoader = require('three-stl-loader')(THREE);

type ThreeShipProps = {
  gid: string;
  position: Vector;
  tractorTargetPosition?: Vector;
  color: string;
  rotation: number;
  radius: number;
  visible: boolean;
  opacity: number;
  hpNormalized: number;
  interactor?: ThreeInteractorProps;
  blow?: boolean;
};

const BEAM_WIDTH = 0.3;
const BLOW_FRAMES = 60;

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
    blow,
  }) => {
    const tractorRef = useRef<Mesh>();
    const mainRef = useRef<Group>();
    const [showExplosion, setShowExplosion] = useState(false);
    // @ts-ignore
    const shipModel = useLoader<Geometry>(
      STLLoader,
      'resources/models/ship.stl'
    );

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
      if (mainRef.current) {
        mainRef.current.userData = mainRef.current.userData || {};
        let displayExplosionCalculated = false;
        if (blow) {
          mainRef.current.userData.blowFrames =
            mainRef.current.userData.blowFrames || 0;
          mainRef.current.userData.blowFrames += 1;
          displayExplosionCalculated =
            mainRef.current.userData.blowFrames <= BLOW_FRAMES;
        }
        if (showExplosion !== displayExplosionCalculated) {
          setShowExplosion(displayExplosionCalculated);
        }
      }
    });

    const memoScale = useMemo(
      () => [0.15, 0.2, 0.25].map((v: number) => v * radius) as Vector3Arr,
      [radius]
    );
    return (
      <group position={posToThreePos(position.x, position.y, 50)} ref={mainRef}>
        {interactor && (
          <ThreeInteractor
            perfId={`ship-${gid}`}
            objectId={gid}
            radius={radius}
            interactor={interactor}
          />
        )}
        <mesh
          position={[0, 0, 0]}
          ref={tractorRef}
          scale={memoScale}
          rotation={[Math.PI, 0, rotation]}
          // @ts-ignore
          geometry={shipModel}
        >
          <meshBasicMaterial color={color} opacity={opacity} transparent />
        </mesh>
        {tractorBeamParams && (
          <mesh
            ref={tractorRef}
            position={tractorBeamParams.position}
            rotation={[0, 0, -tractorBeamParams.rotation]}
          >
            <cylinderBufferGeometry
              args={[BEAM_WIDTH, BEAM_WIDTH, tractorBeamParams.length, 4]}
            />
            <rawShaderMaterial
              transparent
              {...jellyfish}
              // uniforms={tractorBeamParams.patchedUniforms}
            />
          </mesh>
        )}
        <ThreeProgressbar
          position={[0, -radius - 1.0, 0]}
          length={radius * 2}
          girth={radius / 5}
          completionNormalized={hpNormalized}
          fillColor={darkGreen}
          backgroundColor={common}
          hideWhenFull
        />
        {showExplosion && (
          <ThreeExplosion
            seed={gid}
            position={[0, 0, radius + 10]}
            radius={radius * 1.5}
            explosionTimeSeconds={4.0}
            autoPlay
          />
        )}
      </group>
    );
  },
  (prevProps, nextProps) => {
    if (!nextProps.visible) {
      return true;
    }
    return shallowEqual(prevProps, nextProps);
  }
);
