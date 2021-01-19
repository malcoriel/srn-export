import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
const model_fix_coeff = 1 / 40;

type VectorArr = [number, number, number];
export const ThreeRock: React.FC<MeshProps & { scale: VectorArr }> = (
  props
) => {
  const container = useRef<Mesh>();
  const gltf: GLTF = useLoader(GLTFLoader, 'resources/models/r1.gltf');
  // const asteroidMap = useLoader(TextureLoader, 'resources/asteroid.jpg');
  const rockMesh = gltf.scene.children[2] as Mesh;
  // asteroidMap.wrapS = asteroidMap.wrapT = ClampToEdgeWrapping;
  useFrame(() => {
    if (container.current) {
      container.current.rotation.x += 0.01;
      container.current.rotation.y -= 0.01;
      container.current.rotation.z += 0.02;
    }
  });

  return (
    <mesh
      ref={container}
      position={props.position}
      scale={
        props.scale
          ? (props.scale.map((s: number) => s * model_fix_coeff) as VectorArr)
          : [model_fix_coeff, model_fix_coeff, model_fix_coeff]
      }
      geometry={rockMesh.geometry}
    >
      <meshBasicMaterial color="gray" />
    </mesh>
  );
};
