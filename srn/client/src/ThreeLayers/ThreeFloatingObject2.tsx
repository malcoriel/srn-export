import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader, Vector3 } from 'react-three-fiber';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ShipAction, ShipActionType } from '../world';
import { actionsActive } from '../utils/ShipControls';
import { useStore } from '../store';
import _ from 'lodash';
import { Color, Group, Mesh, MeshBasicMaterial } from 'three';

export const ThreeFloatingObject2: React.FC<{
  position: Vector3;
  radius: number;
  scale: number;
  colors?: string[];
  gid: string;
  modelName: string;
  meshes: string[];
}> = ({ position, meshes, gid, radius, colors, modelName, scale }) => {
  const container = useRef<Group>(null);
  const gltf: GLTF = useLoader(GLTFLoader, `resources/models/${modelName}`);
  // Gltf scene meshes cannot be reused if rendered directly like here (if it's not e.g. just geometry)
  // https://github.com/pmndrs/react-three-fiber/issues/245#issuecomment-554612085
  // https://github.com/pmndrs/react-three-fiber/issues/1255
  // https://stackoverflow.com/questions/67154742/react-three-react-three-fiber-useloader-to-load-new-file-on-props-change
  const copiedScene = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  const gltfMeshes = meshes.map((path) => _.get(copiedScene.children, path));

  const refsArr = gltfMeshes.map(() => useRef<Mesh>(null));

  const materialsReplacements = useMemo(() => {
    if (colors) {
      return colors.map((c) => {
        const meshBasicMaterial = new MeshBasicMaterial();
        meshBasicMaterial.color = new Color(c);
        return meshBasicMaterial;
      });
    }
    return [];
  }, [colors]);

  useFrame(() => {
    if (container && container.current && container.current.rotation) {
      container.current.rotation.x += 0.01;
      container.current.rotation.y -= 0.01;
      container.current.rotation.z += 0.02;
    }
    for (let i = 0; i < refsArr.length; i++) {
      const ref = refsArr[i];
      if (ref.current && colors && colors[i]) {
        ref.current.material = materialsReplacements[i];
      }
    }
  });

  const setHintedObjectId = useStore((state) => state.setHintedObjectId);

  const onClick = (ev: any) => {
    actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(gid);
    ev.stopPropagation();
  };
  return (
    <group
      position={position}
      onClick={onClick}
      scale={[radius * scale, radius * scale, radius * scale]}
    >
      <mesh
        onPointerOver={() => setHintedObjectId(gid)}
        onPointerOut={() => setHintedObjectId(undefined)}
      >
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial opacity={0.0} transparent />
      </mesh>
      <group ref={container}>
        {gltfMeshes.map((m, i) => (
          <primitive key={i} object={m} ref={refsArr[i]} />
        ))}
      </group>
    </group>
  );
};
