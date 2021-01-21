import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

const model_fix_coeff = 1 / 5;

export const ThreeRock: React.FC<
  MeshProps & { radius: number; color: string }
> = (props) => {
  const container = useRef<Mesh>();
  const gltf: GLTF = useLoader(GLTFLoader, 'resources/models/asteroid.glb');
  const rockMesh = gltf.scene.children[2] as Mesh;
  useFrame(() => {
    if (container.current) {
      container.current.rotation.x += 0.01;
      container.current.rotation.y -= 0.01;
      container.current.rotation.z += 0.02;
    }
  });

  // @ts-ignore
  // rockMesh.material.color = props.color;
  return (
    <mesh
      ref={container}
      position={props.position}
      scale={[
        props.radius * model_fix_coeff,
        props.radius * model_fix_coeff,
        props.radius * model_fix_coeff,
      ]}
      geometry={rockMesh.geometry}
    >
      <meshBasicMaterial color={props.color} />
    </mesh>
  );
};
