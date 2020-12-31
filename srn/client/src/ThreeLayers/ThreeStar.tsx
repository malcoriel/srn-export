import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import * as THREE from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import _ from 'lodash';
import { unitsToPixels } from '../world';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreeStar: React.FC<MeshProps & { color?: string }> = (props) => {
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
    camera.position.x * unitsToPixels,
    camera.position.y * unitsToPixels
  );

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