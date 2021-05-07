import React, { useMemo, useRef } from 'react';
import { MeshProps, useFrame, useLoader, useThree } from 'react-three-fiber';
import * as THREE from 'three';
import { Mesh, ShaderMaterial, TextureLoader, Vector3 } from 'three';
import { fragmentShader, uniforms, vertexShader } from './shaders/star';
import { VisualState } from '../NetState';
import { unitsToPixels_min } from '../coord';
import { shallowEqual } from '../utils/shallowCompare';
import { normalizeColor } from '../utils/palette';
import _ from 'lodash';

export const useRepeatWrappedTextureLoader = (path: string) => {
  const texture = useLoader(TextureLoader, path);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
};

export const ThreeStar: React.FC<
  MeshProps & {
    color?: string;
    coronaColor?: string;
    scale: [number, number, number];
    visible: boolean;
    visualState: VisualState;
    timeScale?: number;
    onClick?: () => void;
  }
> = React.memo(
  (props) => {
    const mesh = useRef<Mesh>();
    const lavaTile = useRepeatWrappedTextureLoader('resources/lavatile.png');
    const grassTile = useRepeatWrappedTextureLoader(
      'resources/bowling_grass.jpg'
    );

    useFrame(() => {
      if (mesh.current) {
        if (props.visible) {
          const material = mesh.current.material as ShaderMaterial;
          material.uniforms.time.value +=
            1.0 * (props.timeScale !== undefined ? props.timeScale : 1.0);
        }
      }
    });

    const uniforms2 = useMemo(() => {
      const patchedUniforms = _.cloneDeep(uniforms);
      patchedUniforms.iChannel0.value = lavaTile;
      patchedUniforms.iChannel1.value = grassTile;
      patchedUniforms.color.value = new Vector3(
        ...normalizeColor(props.color || 'white')
      );
      patchedUniforms.coronaColor.value = new Vector3(
        ...normalizeColor(props.coronaColor || 'white')
      );
      return patchedUniforms;
    }, [
      grassTile,
      lavaTile,
      props.coronaColor,
      // eslint-disable-next-line react-hooks/exhaustive-deps
      unitsToPixels_min(),
      props.color,
    ]);

    return (
      <mesh {...props} ref={mesh} rotation={[0, 0, 0]} onClick={props.onClick}>
        <planeBufferGeometry args={[2, 2]} />
        <rawShaderMaterial
          transparent
          fragmentShader={fragmentShader}
          vertexShader={vertexShader}
          uniforms={uniforms2}
        />
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
