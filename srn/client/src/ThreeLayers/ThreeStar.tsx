import React, { useMemo, useRef } from 'react';
import Color from 'color';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import * as THREE from 'three';
import { Mesh, ShaderMaterial, TextureLoader, Vector2, Vector3 } from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import { VisualState } from '../NetState';
import { unitsToPixels_min } from '../coord';
import { shallowEqual } from '../utils/shallowCompare';

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
          material.uniforms.time.value += 1;
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
      return patchedUniforms;
      // eslint-disable-next-line
    }, [zoomProp, unitsToPixels_min(), camera.position.x, camera.position.y]);

    return (
      <mesh {...props} ref={mesh} rotation={[0, 0, 0]}>
        <planeBufferGeometry args={[2, 2]} />
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
