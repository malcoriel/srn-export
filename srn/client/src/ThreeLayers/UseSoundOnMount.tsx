import React, { useEffect, useRef } from 'react';
import { PositionalAudio } from '@react-three/drei';
import { UseSoundOnMountProps } from './ThreeShip';

export const useSoundOnMount = ({
  path,
  distance = 99999,
}: UseSoundOnMountProps) => {
  const soundRef = useRef<any>();

  useEffect(() => {
    if (!soundRef.current) {
      return;
    }
    soundRef.current.play();
  }, [soundRef]);
  return (
    <PositionalAudio
      ref={soundRef}
      url={`/resources/${path}`}
      distance={distance}
      loop={false}
    />
  );
};
