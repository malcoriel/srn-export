import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';

const expectedResources = [
  // minimal set of resources to load the game
  'resources/ship.stl',
  'resources/textures/gas-giants/008FA9.png',
];

export const useResourcesLoading = () => {
  const [attemptedResources, setAttemptedResources] = useState([] as string[]);
  const [delayed, setDelayed] = useState(true);
  const { progress: threeLoaderProgress, item, total, loaded } = useProgress();
  useEffect(() => {
    setAttemptedResources((old) => [...old, item]);
  }, [item]);
  const missingResources = new Set(expectedResources);
  for (const res of attemptedResources) {
    missingResources.delete(res);
  }
  const isLoading = Math.abs(threeLoaderProgress - 100) > 1e-9;
  const areLoading = isLoading || missingResources.size > 0;
  const formattedProgress = `${Math.floor((loaded / total) * 100 || 0).toFixed(
    0
  )}% (${loaded}/${total})`;
  useEffect(() => {
    if (!areLoading) {
      // artificial delay to show 100%
      setTimeout(() => {
        setDelayed(false);
      }, 100);
    }
  }, [areLoading]);
  return [areLoading || delayed, formattedProgress];
};
