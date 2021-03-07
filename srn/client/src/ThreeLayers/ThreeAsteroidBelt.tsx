import React, { useMemo, useRef } from 'react';
import { useLoader } from 'react-three-fiber';
import { Mesh, BufferGeometry, Matrix4, Quaternion, Euler } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import Prando from 'prando';
import { Vector3 } from 'three/src/math/Vector3';
import { posToThreePos, Vector3Arr } from './ThreeLayer';
const model_fix_coeff = 1;
const anti_model_fix_coeff = 1;

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
  const gltf: GLTF = useLoader(GLTFLoader, 'resources/models/asteroid.glb');

  // const asteroidMap = useLoader(TextureLoader, 'resources/asteroid.jpg');
  const rockMesh = gltf.scene.children[2] as Mesh;

  const mergedGeometry = useMemo<BufferGeometry>(() => {
    const prng = new Prando(gid);
    const geometryList = [];
    const angleStep = (Math.PI * 2) / count;
    let currentAngle = 0;
    for (let i = 0; i < count; ++i) {
      const current = rockMesh.geometry.clone() as BufferGeometry;
      let x = Math.cos(currentAngle) * radius * anti_model_fix_coeff;
      let y = Math.sin(currentAngle) * radius * anti_model_fix_coeff;
      const offsetX = prng.next(-width / 2, width / 2);
      const offsetY = prng.next(-width / 2, width / 2);
      x += offsetX * anti_model_fix_coeff;
      y += offsetY * anti_model_fix_coeff;
      const scale = prng.next(0.1, 0.5);
      current.scale(scale, scale, scale);
      const matrix = new Matrix4().compose(
        new Vector3(...posToThreePos(x, y)),
        new Quaternion().setFromEuler(
          new Euler(
            prng.next(0, Math.PI / 2),
            prng.next(0, Math.PI / 2),
            prng.next(0, Math.PI / 2)
          )
        ),
        new Vector3(1, 1, 1)
      );
      current.applyMatrix4(matrix);
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
      material={rockMesh.material}
    />
  );
};
