import { useEffect, useState } from 'react';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import { explosionSfxFull } from '../ThreeLayers/blocks/ThreeExplosion';

const expectedResources = [
  // minimal set of resources to load the game
  'resources/models/ship.stl',
  'resources/bowling_grass.jpg',
  'resources/lavatile.png',
  ...explosionSfxFull,
  // all of these MUST be preloaded because if a map doesn't have the
  // assets that use them, loading will be forever stuck
];

export const useResourcesLoading = () => {
  const [attemptedResources, setAttemptedResources] = useState([] as string[]);
  const { item, total, loaded, active } = useProgress();
  useEffect(() => {
    setAttemptedResources((old) => [...old, item]);
  }, [item]);
  const missingResources = new Set(expectedResources);
  for (const res of attemptedResources) {
    missingResources.delete(res);
  }
  const basicResourcesMissing = missingResources.size > 0;
  let areLoading = active || basicResourcesMissing;
  let cached = false;
  if (THREE.Cache.files[item]) {
    cached = true;
    areLoading = false;
  }
  const formattedProgress = `${Math.floor((loaded / total) * 100 || 0).toFixed(
    0
  )}% (${loaded}/${total})`;
  // console.log(areLoading, cached, item, formattedProgress);
  return [areLoading, formattedProgress, !basicResourcesMissing];
};
