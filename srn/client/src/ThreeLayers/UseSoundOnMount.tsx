import { PositionalAudio } from '@react-three/drei';
import React, { Suspense } from 'react';

export type UseSoundOnMountProps = {
  path: string;
  distance?: number;
};
export const useSoundOnMount = ({
  path,
  distance = 99999,
}: UseSoundOnMountProps) => {
  return (
    <Suspense fallback={<mesh />}>
      <PositionalAudio
        url={`/resources/${path}`}
        distance={distance}
        loop={false}
        autoplay
      />
    </Suspense>
  );
};
