import React, { useRef } from 'react';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import {
  Mesh,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  Vector3,
  Texture,
} from 'three';
import * as THREE from 'three';
import { CellularNoiseMaterial } from 'threejs-shader-materials';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import _ from 'lodash';
import { unitsToPixels } from '../world';
import {
  RGBAFormat,
  RGBFormat,
  LinearMipMapLinearFilter,
} from 'three/src/constants';

const noiseMaterial = new CellularNoiseMaterial();
noiseMaterial.isAnimate = true;
noiseMaterial.grid = 75;
noiseMaterial.divisionScaleX = 2;
noiseMaterial.speed = 3;

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const Sphere: React.FC<
  MeshProps & { color?: string; star?: boolean }
> = (props) => {
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
  const checkersMap = useLoader(TextureLoader, 'resources/checkers.jpg');
  const lavaTile = useRepeatWrappedTextureLoader('resources/lavatile.png');
  const grassTile = useRepeatWrappedTextureLoader(
    'resources/bowling_grass.jpg'
  );

  const color = props.color || 'white';

  const { camera } = useThree();

  useFrame(() => {
    if (mesh.current) {
      if (props.star) {
        let material = mesh.current.material as ShaderMaterial;
        material.uniforms.time.value += 0.008;
      } else {
        mesh.current.rotation.y = mesh.current.rotation.y += 0.02;
      }
    }
  });

  const patchedUniforms = _.clone(uniforms);
  patchedUniforms.iChannel0.value = lavaTile;
  patchedUniforms.iChannel1.value = grassTile;
  patchedUniforms.time.value = 1;
  patchedUniforms.color.value = new Vector3(180 / 255, 149 / 255, 139 / 255);
  patchedUniforms.shift.value = new Vector2(
    camera.position.x * unitsToPixels,
    camera.position.y * unitsToPixels
  );

  let rotation: [number, number, number] = [0, 0, 0];
  return (
    <mesh {...props} ref={mesh} rotation={rotation}>
      <icosahedronBufferGeometry args={[1, 5]} />
      {props.star ? (
        <rawShaderMaterial
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={uniforms}
        />
      ) : (
        <meshBasicMaterial color={color} map={space01map} />
      )}
    </mesh>
  );
};
