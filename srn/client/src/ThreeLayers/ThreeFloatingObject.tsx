import React, { useMemo, useRef } from 'react';
import { useFrame, useLoader, Vector3 } from 'react-three-fiber';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import _ from 'lodash';
import { Color, Group, Mesh, MeshBasicMaterial } from 'three';
import {
  InteractorActionType,
  ThreeInteractor,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import { containerHintContent } from '../HtmlLayers/HintWindow';
import { rare } from '../utils/palette';
import { containerActionsMap } from './ContainersLayer';

export const ModelMeshMap: Record<string, string[]> = {
  'container.glb': ['0.children.0', '0.children.1', '0.children.2'],
  'asteroid.glb': ['2'],
};

export const InteractorMap: Record<string, ThreeInteractorProps> = {
  container: {
    hint: containerHintContent(),
    defaultAction: InteractorActionType.Tractor,
    outlineColor: rare,
    actions: containerActionsMap,
  },
};

export const ThreeFloatingObject: React.FC<{
  position: Vector3;
  radius: number;
  scale: number;
  colors?: string[];
  gid: string;
  modelName: string;
  meshes?: string[];
  interactorKind?: string;
  interactor?: ThreeInteractorProps;
}> = ({
  interactor,
  position,
  meshes,
  gid,
  radius,
  colors,
  modelName,
  interactorKind,
  scale,
}) => {
  const container = useRef<Group>(null);
  const gltf: GLTF = useLoader(GLTFLoader, `resources/models/${modelName}`);
  // Gltf scene meshes cannot be reused if rendered directly like here (if it's not e.g. just geometry)
  // https://github.com/pmndrs/react-three-fiber/issues/245#issuecomment-554612085
  // https://github.com/pmndrs/react-three-fiber/issues/1255
  // https://stackoverflow.com/questions/67154742/react-three-react-three-fiber-useloader-to-load-new-file-on-props-change
  const copiedScene = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  const usedMeshes = meshes || ModelMeshMap[modelName] || [];
  const gltfMeshes = usedMeshes.map((path) =>
    _.get(copiedScene.children, path)
  );

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

  const usedInteractor = interactor || InteractorMap[interactorKind || ''];
  return (
    <group position={position}>
      {usedInteractor && (
        <ThreeInteractor
          objectId={gid}
          radius={radius}
          interactor={usedInteractor}
        />
      )}
      <group
        ref={container}
        scale={[radius * scale, radius * scale, radius * scale]}
      >
        {gltfMeshes.map((m, i) => (
          <primitive key={i} object={m} ref={refsArr[i]} />
        ))}
      </group>
    </group>
  );
};
