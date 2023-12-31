import React, { useMemo, useRef } from 'react';
import { IVector } from '../utils/Vector';
import { Mesh, ShaderMaterial, Texture, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import _ from 'lodash';
import { common, darkGreen, normalizeColor } from '../utils/palette';
import { size, unitsToPixels_min } from '../coord';
import { shallowEqual } from '../utils/shallowCompare';
import { useRepeatWrappedTextureLoader } from './ThreeStar';
import {
  defaultUniformValues,
  fragmentShader,
  gasGiantShaderRandomProps,
  uniforms,
  vertexShader,
} from './shaders/gasGiant';
import {
  ThreeInteractor,
  ThreeInteractorProps,
} from './blocks/ThreeInteractor';
import { vecToThreePos } from './util';
import { ThreeProgressbar } from './blocks/ThreeProgressbar';

export const ThreePlanetShape: React.FC<{
  gid: string;
  position: IVector;
  onClick?: (e: any) => void;
  radius: number;
  color?: string;
  atmosphereColor?: string;
  atmospherePercent?: number;
  detail?: number;
  rotationSpeed?: number;
  spotsRotationSpeed?: number;
  spotsRandomizingFactor?: number;
  spotsIntensity?: number;
  yStretchFactor?: number;
  visible?: boolean;
  texture?: Texture;
  interactor?: ThreeInteractorProps;
  hpNormalized?: number;
}> = React.memo(
  ({
    gid,
    onClick,
    position,
    atmosphereColor,
    radius,
    detail,
    rotationSpeed,
    spotsRotationSpeed,
    spotsRandomizingFactor,
    yStretchFactor,
    spotsIntensity,
    color,
    visible = true,
    atmospherePercent,
    texture,
    interactor,
    hpNormalized,
  }) => {
    const shaderProps = useMemo(() => {
      return _.assign(
        {
          detail,
          rotationSpeed,
          spotsRotationSpeed,
          spotsRandomizingFactor,
          spotsIntensity,
          yStretchFactor,
        },
        gasGiantShaderRandomProps(gid, radius)
      );
    }, [
      gid,
      radius,
      detail,
      rotationSpeed,
      spotsRotationSpeed,
      spotsRandomizingFactor,
      spotsIntensity,
      yStretchFactor,
    ]);

    const mesh = useRef<Mesh>();
    useFrame(() => {
      if (mesh.current && visible) {
        const material = mesh.current.material as ShaderMaterial;
        if (material.uniforms) {
          material.uniforms.time.value += 1;
        }
      }
    });

    let resolvedTexture: Texture;
    if (color && !texture) {
      const key = color.replace('#', '').toUpperCase();
      resolvedTexture = useRepeatWrappedTextureLoader(
        `resources/textures/gas-giants/${key}.png`
      );
    } else if (texture && !color) {
      resolvedTexture = texture;
    } else {
      throw new Error('Invalid combination of color and texture');
    }

    const uniforms2 = useMemo(() => {
      const patchedUniforms = _.cloneDeep(uniforms);
      patchedUniforms.iChannel0.value = resolvedTexture;
      patchedUniforms.rotationSpeed.value =
        rotationSpeed || defaultUniformValues.rotationSpeed;
      patchedUniforms.yStretchFactor.value =
        shaderProps.yStretchFactor || defaultUniformValues.yStretchFactor;
      patchedUniforms.spotsIntensity.value =
        shaderProps.spotsIntensity || defaultUniformValues.spotsIntensity;
      patchedUniforms.spotsRandomizingFactor.value =
        shaderProps.spotsRandomizingFactor ||
        defaultUniformValues.spotsRandomizingFactor;
      patchedUniforms.spotsRotationSpeed.value =
        shaderProps.spotsRotationSpeed ||
        defaultUniformValues.spotsRotationSpeed;
      patchedUniforms.detailOctaves.value =
        shaderProps.detail || defaultUniformValues.detailOctaves;
      patchedUniforms.atmosphereColor.value = atmosphereColor
        ? new Vector3(...normalizeColor(atmosphereColor))
        : defaultUniformValues.atmosphereColor;
      patchedUniforms.atmospherePercent.value =
        atmospherePercent || defaultUniformValues.atmospherePercent;

      patchedUniforms.iResolution.value = new Vector3(
        size.width_px,
        size.height_px,
        0
      );
      return patchedUniforms;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [unitsToPixels_min(), texture, atmospherePercent, atmosphereColor]);

    return (
      <group position={vecToThreePos(position, 10)} visible={visible}>
        {interactor && (
          <ThreeInteractor
            perfId={`planet-${gid}`}
            objectId={gid}
            radius={radius}
            interactor={interactor}
          />
        )}
        <mesh
          onClick={onClick || ((_e) => {})}
          ref={mesh}
          scale={[radius, radius, radius]}
          rotation={[0, 0, 0]}
        >
          <planeBufferGeometry args={[1, 1]} />
          <rawShaderMaterial
            key={texture ? texture.uuid : '1'}
            transparent
            fragmentShader={fragmentShader}
            vertexShader={vertexShader}
            uniforms={uniforms2}
          />
        </mesh>
        {!_.isNil(hpNormalized) && (
          <ThreeProgressbar
            position={[0, -radius - 1.0, 0]}
            length={radius}
            girth={radius / 20}
            completionNormalized={hpNormalized}
            fillColor={darkGreen}
            backgroundColor={common}
            hideWhenFull
          />
        )}
      </group>
    );
  },
  (prev, next) => {
    if (prev && !prev.visible && next && !next.visible) {
      return true;
    }
    return shallowEqual(prev, next);
  }
);
