import React, { useEffect, useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import {
  ClampToEdgeWrapping,
  Color,
  Mesh,
  MeshBasicMaterial,
  RepeatWrapping,
  TextureLoader,
} from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { Vector3 } from 'three/src/math/Vector3';

export const ThreeRock: React.FC<MeshProps> = (props) => {
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
      scale={[1 / 20, 1 / 20, 1 / 20]}
      geometry={rockMesh.geometry}
    >
      <meshBasicMaterial color="gray" />
    </mesh>
  );
};
