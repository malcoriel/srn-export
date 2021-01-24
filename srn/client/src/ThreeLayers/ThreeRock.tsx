import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh } from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { ShipAction, ShipActionType } from '../world';
import { actionsActive } from '../utils/ShipControls';
import { useStore } from '../store';

const model_fix_coeff = 1 / 5;

export const ThreeRock: React.FC<
  MeshProps & { radius: number; color: string; gid: string }
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

  const setHintedObjectId = useStore((state) => state.setHintedObjectId);

  // @ts-ignore
  // rockMesh.material.color = props.color;
  return (
    <group position={props.position}>
      <mesh
        onPointerOver={() => setHintedObjectId(props.gid)}
        onPointerOut={() => setHintedObjectId(undefined)}
      >
        <circleBufferGeometry args={[props.radius, 16]} />
        <meshBasicMaterial color="red" opacity={0.0} transparent={true} />
      </mesh>
      <mesh
        ref={container}
        onClick={(ev: any) => {
          actionsActive[ShipActionType.Tractor] = ShipAction.Tractor(props.gid);
          ev.stopPropagation();
        }}
        scale={[
          props.radius * model_fix_coeff,
          props.radius * model_fix_coeff,
          props.radius * model_fix_coeff,
        ]}
        geometry={rockMesh.geometry}
      >
        <meshBasicMaterial color={props.color} />
      </mesh>
    </group>
  );
};
