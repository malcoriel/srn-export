import React, { useMemo, useRef } from 'react';
import Color from 'color';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import * as THREE from 'three';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import NetState from '../NetState';
import { size, unitsToPixels_min } from '../coord';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreeStar: React.FC<
  MeshProps & {
    color?: string;
    scale: [number, number, number];
    visible: boolean;
  }
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

  const color = useMemo(() => Color(props.color || 'white'), [props.color]);

  const { camera } = useThree();

  useFrame(() => {
    if (mesh.current) {
      if (props.visible) {
        let material = mesh.current.material as ShaderMaterial;
        material.uniforms.time.value += 0.008;
      }
    }
  });

  const uniforms2 = useMemo(() => {
    const patchedUniforms = uniforms;
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
    return patchedUniforms;
    // eslint-disable-next-line
  }, [zoomProp, unitsToPixels_min(), camera.position.x, camera.position.y]);

  return (
    <mesh {...props} ref={mesh} rotation={[0, 0, 0]}>
      <icosahedronBufferGeometry args={[1, 5]} />
      <rawShaderMaterial
        transparent={true}
        fragmentShader={fragmentShader}
        vertexShader={vertexShader}
        uniforms={uniforms2}
      />
      {/*<meshBasicMaterial color="red" />*/}
    </mesh>
  );
};
