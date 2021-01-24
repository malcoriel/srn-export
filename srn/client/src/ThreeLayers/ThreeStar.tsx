import React, { useRef } from 'react';
import Color from 'color';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import * as THREE from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import _ from 'lodash';
import NetState from '../NetState';
import { size, unitsToPixels_min } from '../world';

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

  const color = Color(props.color || 'white');

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
  patchedUniforms.color.value = new Vector3(
    color.red() / 255,
    color.green() / 255,
    color.blue() / 255
  );
  patchedUniforms.shift.value = new Vector2(
    (camera.position.x * unitsToPixels_min()) / zoomProp,
    (camera.position.y * unitsToPixels_min()) / zoomProp
  );
  patchedUniforms.iResolution.value = new Vector3(
    size.width_px,
    size.height_px,
    0
  );
  // 10 -> 0.25
  // 20 -> 0.5
  patchedUniforms.srcRadius.value = ((props.scale[0] / 10) * 0.18) / zoomProp;
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
        transparent={true}
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms}
      />
      {/*<meshBasicMaterial color="red" />*/}
    </mesh>
  );
};
