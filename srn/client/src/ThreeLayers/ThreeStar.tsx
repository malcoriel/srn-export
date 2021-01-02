import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import * as THREE from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import _ from 'lodash';
import NetState from '../NetState';
import { unitsToPixels_min, unitsToPixels_x, unitsToPixels_y } from '../world';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreeStar: React.FC<
  MeshProps & { color?: string; scale: [number, number, number] }
> = (props) => {
  const ns = NetState.get();
  if (!ns) return null;
  const { visualState } = ns;
  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const mesh = useRef<Mesh>();
  const lavaTile = useRepeatWrappedTextureLoader('resources/lavatile.png');
  const grassTile = useRepeatWrappedTextureLoader(
    'resources/bowling_grass.jpg'
  );

  const color = props.color || 'white';

  const { camera } = useThree();

  useFrame(() => {
    if (mesh.current) {
      let material = mesh.current.material as ShaderMaterial;
      material.uniforms.time.value += 0.008;
    }
  });

  const patchedUniforms = _.clone(uniforms);
  patchedUniforms.iChannel0.value = lavaTile;
  patchedUniforms.iChannel1.value = grassTile;
  patchedUniforms.color.value = new Vector3(180 / 255, 149 / 255, 139 / 255);
  patchedUniforms.shift.value = new Vector2(
    (camera.position.x * unitsToPixels_min()) / zoomProp,
    (camera.position.y * unitsToPixels_min()) / zoomProp
  );
  // 10 -> 0.25
  // 20 -> 0.5
  patchedUniforms.srcRadius.value = ((props.scale[0] / 10) * 0.25) / zoomProp;
  // patchedUniforms.iResolution.value = new Vector3(
  //   width_px / 10,
  //   height_px / 10,
  //   0
  // );

  let rotation: [number, number, number] = [0, 0, 0];
  return (
    <mesh {...props} ref={mesh} rotation={rotation}>
      <icosahedronBufferGeometry args={[1, 5]} />
      <rawShaderMaterial
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
      />
    </mesh>
  );
};
