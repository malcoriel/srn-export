import React, { Suspense, useRef, useState } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, TextureLoader } from 'three';
import { Cube } from '../Srn';

export const Sphere: React.FC<MeshProps> = (props) => {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  useFrame(() => {
    if (mesh.current) mesh.current.rotation.z = mesh.current.rotation.z += 0.01;
  });

  return (
    <mesh
      {...props}
      ref={mesh}
      scale={[50, 50, 50]}
      onClick={(event: any) => setActive(!active)}
      onPointerOver={(event: any) => setHover(true)}
      onPointerOut={(event: any) => setHover(false)}
    >
      <icosahedronBufferGeometry args={[1, 5]} />
      <meshStandardMaterial
        color={hovered ? 'hotpink' : 'orange'}
        map={space01map}
      />
    </mesh>
  );
};
export const TexturedSphere = (props: any) => {
  return (
    <Suspense fallback={<Cube />}>
      <Sphere {...props} />
    </Suspense>
  );
};
