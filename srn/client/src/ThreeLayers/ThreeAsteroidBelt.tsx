import React, { useMemo, useRef } from 'react';
import { MeshProps, useLoader } from 'react-three-fiber';
import { Mesh, BufferGeometry, Matrix4 } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { posToThreePos, Vector3Arr } from './ThreeLayer';
import Prando from 'prando';
const model_fix_coeff = 1 / 40;
const anti_model_fix_coeff = 40;

export const ThreeAsteroidBelt: React.FC<{
  count: number;
  radius: number;
  rotation: Vector3Arr;
  width: number;
  scale_mod: number;
  position: Vector3Arr;
  gid: string;
}> = ({ count, radius, position, scale_mod, rotation, gid, width }) => {
  const container = useRef<Mesh>();
  const gltf: GLTF = useLoader(GLTFLoader, 'resources/models/r1.gltf');
  // const asteroidMap = useLoader(TextureLoader, 'resources/asteroid.jpg');
  const rockMesh = gltf.scene.children[2] as Mesh;

  const mergedGeometry = useMemo<BufferGeometry>(() => {
    const prng = new Prando(gid);
    const geometryList = [];
    const angleStep = (Math.PI * 2) / count;
    let currentAngle = 0;
    for (let i = 0; i < count; ++i) {
      let current = rockMesh.geometry.clone() as BufferGeometry;
      let x = Math.cos(currentAngle) * radius * anti_model_fix_coeff;
      let y = Math.sin(currentAngle) * radius * anti_model_fix_coeff;
      let offsetX = prng.next(-width / 2, width / 2);
      let offsetY = prng.next(-width / 2, width / 2);
      x += offsetX * anti_model_fix_coeff;
      y += offsetY * anti_model_fix_coeff;
      let scale = prng.next(0.1, 0.5);
      current.scale(scale, scale, scale);

      current.applyMatrix4(
        new Matrix4().makeTranslation(...posToThreePos(x, y))
      );
      geometryList.push(current);
      currentAngle += angleStep;
    }
    return BufferGeometryUtils.mergeBufferGeometries(geometryList);
  }, [count, radius, gid]);

  return (
    <mesh
      ref={container}
      position={position}
      scale={[model_fix_coeff, model_fix_coeff, model_fix_coeff]}
      rotation={rotation}
      geometry={mergedGeometry}
    >
      <meshBasicMaterial color="#60593c" />
    </mesh>
  );
};
