import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import { Mesh, TextureLoader } from 'three';
import * as THREE from 'three';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreePlanetShape: React.FC<MeshProps & { color?: string }> = (
  props
) => {
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');

  const color = props.color || 'white';

  useFrame(() => {
    if (mesh.current) {
      mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
    }
  });

  let rotation: [number, number, number] = [0, 0, 0];
  return (
    <mesh {...props} ref={mesh} rotation={rotation}>
      <icosahedronBufferGeometry args={[1, 5]} />
      <meshBasicMaterial color={color} map={space01map} />
    </mesh>
  );
};
