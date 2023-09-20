import { useRef } from 'react';
import { Material, MeshBasicMaterial, RawShaderMaterial } from 'three';
import { useFrame } from '@react-three/fiber';

const setOpacity = (mat: Material, value: number) => {
  if (
    typeof (mat as RawShaderMaterial)?.uniforms?.opacity?.value !== 'undefined'
  ) {
    (mat as RawShaderMaterial).uniforms.opacity.value = value;
  } else if (typeof mat.opacity !== 'undefined') {
    mat.opacity = value;
  }
};

const getOpacity = (mat: Material): number | null => {
  if (
    typeof (mat as RawShaderMaterial)?.uniforms?.opacity?.value !== 'undefined'
  ) {
    return (mat as RawShaderMaterial).uniforms.opacity.value;
  }
  if (typeof mat.opacity !== 'undefined') {
    return mat.opacity;
  }
  return null;
};

export const useFadingMaterial = (
  fadeOverTicks: number | undefined,
  opacity = 1.0
) => {
  const material = useRef<MeshBasicMaterial>(null);
  useFrame((_state, deltaS) => {
    if (!material.current) {
      return;
    }

    const currentOpacity = getOpacity(material.current);
    if (!fadeOverTicks) {
      if (currentOpacity !== 1.0) {
        setOpacity(material.current, opacity);
      }
      return;
    }

    if (typeof material.current.userData.fadeTimer === 'undefined') {
      material.current.userData.fadeTimer = 0;
    }
    if (currentOpacity && currentOpacity > 0) {
      material.current.userData.fadeTimer += deltaS * 1e6;
      setOpacity(
        material.current,
        opacity *
          (1.0 -
            Math.min(material.current.userData.fadeTimer / fadeOverTicks, 1.0))
      );
    }
  });
  return material;
};
