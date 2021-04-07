import React, { useMemo, useRef } from 'react';
import Color from 'color';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import * as THREE from 'three';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import NetState, { VisualState } from '../NetState';
import { size, unitsToPixels_min } from '../coord';
import { shallowEqual } from '../utils/shallowCompare';
import Vector, { VectorFzero } from '../utils/Vector';

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
    visualState: VisualState;
  }
> = React.memo(
  (props) => {
    const zoomProp = 1 / (props.visualState.zoomShift || 1.0);

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
          const material = mesh.current.material as ShaderMaterial;
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
      let pos: Vector;
      if (props.position) {
        // @ts-ignore
        pos = new Vector(props.position[0], -props.position[1]);
      } else {
        pos = VectorFzero();
      }
      patchedUniforms.shift.value = new Vector2(
        ((-pos.x + camera.position.x) * unitsToPixels_min()) / zoomProp,
        ((pos.y + camera.position.y) * unitsToPixels_min()) / zoomProp
      );
      patchedUniforms.iResolution.value = new Vector3(
        size.width_px,
        size.height_px,
        0
      );
      // 10 -> 0.25
      // 20 -> 0.5
      patchedUniforms.srcRadius.value =
        ((props.scale[0] / 10) * 0.18) / zoomProp;
      return patchedUniforms;
      // eslint-disable-next-line
    }, [zoomProp, unitsToPixels_min(), camera.position.x, camera.position.y]);

    return (
      <mesh {...props} ref={mesh} rotation={[0, 0, 0]}>
        <icosahedronBufferGeometry args={[1, 5]} />
        <rawShaderMaterial
          transparent
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={uniforms2}
        />
        {/*<meshBasicMaterial color="red" />*/}
      </mesh>
    );
  },
  (prevProps, nextProps) => {
    if (!nextProps.visible) {
      return true;
    }
    return shallowEqual(prevProps, nextProps);
  }
);
