import { useRef } from 'react';
import { MeshBasicMaterial } from 'three';
import { useFrame } from '@react-three/fiber';

export const useFadingMaterial = (
  fadeOverTicks: number | undefined,
  opacity: number
) => {
  const material = useRef<MeshBasicMaterial>(null);
  useFrame((_state, deltaS) => {
    if (!material.current) {
      return;
    }
    if (!fadeOverTicks) {
      material.current.opacity = opacity;
      return;
    }
    if (material.current.opacity > 0) {
      if (typeof material.current.userData.fadeTimer === 'undefined') {
        material.current.userData.fadeTimer = 0;
      }
      material.current.userData.fadeTimer += deltaS * 1e6;
      material.current.opacity =
        opacity *
        (1.0 -
          Math.min(material.current.userData.fadeTimer / fadeOverTicks, 1.0));
    }
  });
  return material;
};
