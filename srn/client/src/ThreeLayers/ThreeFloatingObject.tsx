import React, { useEffect, useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ShipAction, ShipActionType } from '../world';
import { actionsActive } from '../utils/ShipControls';
import { useStore } from '../store';

const model_fix_coeff = 1 / 5;

export const ThreeFloatingObject: React.FC<
  MeshProps & {
    radius: number;
    color: string;
    gid: string;
    modelName: string;
    modelGltfIndex: number;
  }
> = ({ position, gid, radius, color, modelName, modelGltfIndex }) => {
  const container = useRef<Mesh>();
  const gltf: GLTF = useLoader(GLTFLoader, `resources/models/${modelName}`);
  useEffect(() => {
    if (modelName === 'container.glb') {
      console.log(Object.keys(gltf.scene.children[0]));
    }
  }, [gltf, modelName]);
  const rockMesh = gltf.scene.children[modelGltfIndex] as Mesh;
  useFrame(() => {
    if (container.current) {
      container.current.rotation.x += 0.01;
      container.current.rotation.y -= 0.01;
      container.current.rotation.z += 0.02;
    }
  });

  const setHintedObjectId = useStore((state) => state.setHintedObjectId);

  // @ts-ignore
  // rockMesh.material.color = props.color;
  const onClick = (ev: any) => {
    actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(gid);
    ev.stopPropagation();
  };
  return (
    <group position={position} onClick={onClick}>
      <mesh
        onPointerOver={() => setHintedObjectId(gid)}
        onPointerOut={() => setHintedObjectId(undefined)}
      >
        <circleBufferGeometry args={[radius, 16]} />
        <meshBasicMaterial color="red" opacity={0.0} transparent />
      </mesh>
      <mesh
        ref={container}
        scale={[
          radius * model_fix_coeff,
          radius * model_fix_coeff,
          radius * model_fix_coeff,
        ]}
        geometry={rockMesh.geometry}
      >
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};
