import React, { useMemo, useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, BufferGeometry, Matrix4 } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { posToThreePos } from './ThreeLayer';
const model_fix_coeff = 1 / 40;
const anti_model_fix_coeff = 40;

type VectorArr = [number, number, number];
export const ThreeAsteroidBelt: React.FC<
  MeshProps & { scale?: VectorArr; count: number; radius: number }
> = ({ count, scale, radius, position }) => {
  const container = useRef<Mesh>();
  const gltf: GLTF = useLoader(GLTFLoader, 'resources/models/r1.gltf');
  // const asteroidMap = useLoader(TextureLoader, 'resources/asteroid.jpg');
  const rockMesh = gltf.scene.children[2] as Mesh;
  useFrame(() => {
    if (container.current) {
      container.current.rotation.z += 0.005;
    }
  });

  const mergedGeometry = useMemo<BufferGeometry>(() => {
    const geometryList = [];
    const angleStep = (Math.PI * 2) / count;
    let currentAngle = 0;
    for (let i = 0; i < count; ++i) {
      let current = rockMesh.geometry.clone() as BufferGeometry;
      let x = Math.cos(currentAngle) * radius * anti_model_fix_coeff;
      let y = Math.sin(currentAngle) * radius * anti_model_fix_coeff;
      current.applyMatrix4(
        new Matrix4().makeTranslation(...posToThreePos(x, y))
      );
      geometryList.push(current);
      currentAngle += angleStep;
    }
    return BufferGeometryUtils.mergeBufferGeometries(geometryList);
  }, [count, radius]);

  return (
    <mesh
      ref={container}
      position={position}
      scale={
        scale
          ? (scale.map((s: number) => s * model_fix_coeff) as VectorArr)
          : [model_fix_coeff, model_fix_coeff, model_fix_coeff]
      }
      geometry={mergedGeometry}
    >
      <meshBasicMaterial color="red" />
    </mesh>
  );
};
