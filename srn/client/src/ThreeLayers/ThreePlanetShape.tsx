import React, { useMemo, useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import * as THREE from 'three';
import { Mesh, TextureLoader } from 'three';
import Color from 'color';
import { shallowEqual } from '../utils/shallowCompare';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreePlanetShape: React.FC<
  MeshProps & { color?: string; visible: boolean }
> = React.memo(
  (props) => {
    const mesh = useRef<Mesh>();
    const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
    const color = useMemo(
      () => Color(props.color).lighten(1.0).hex() || 'white',
      [props.color]
    );

    useFrame(() => {
      if (mesh.current && props.visible) {
        mesh.current.rotation.y += 0.02;
      }
    });

    return (
      <mesh {...props} ref={mesh} rotation={[0, 0, 0]}>
        <icosahedronBufferGeometry args={[1, 5]} />
        <meshBasicMaterial color={color} map={space01map} />
      </mesh>
    );
  },
  (prev, next) => {
    if (!next.visible) {
      return true;
    }
    return shallowEqual(prev, next);
  }
);
