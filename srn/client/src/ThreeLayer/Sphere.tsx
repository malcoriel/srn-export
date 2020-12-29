import React, { Suspense, useRef, useState } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, TextureLoader } from 'three';

export const Sphere: React.FC<MeshProps & { color?: string }> = (props) => {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
  const color = props.color || 'white';

  useFrame(() => {
    if (mesh.current) mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
  });

  return (
    <mesh {...props} ref={mesh} rotation={[Math.PI / 2, Math.PI, 0]}>
      <icosahedronBufferGeometry args={[1, 5]} />
      <meshStandardMaterial color={color} map={space01map} />
    </mesh>
  );
};
