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
  const { item, total, loaded, active } = useProgress();
  const missingResources = new Set(expectedResources);
  for (const res of Object.keys(THREE.Cache.files)) {
    missingResources.delete(res);
  }
  const basicResourcesMissing = missingResources.size > 0;
  // active property can lie and just means 'downloads in progress'
  const areLoading = active || basicResourcesMissing;
  const formattedProgress = `${Math.floor((loaded / total) * 100 || 0).toFixed(
    0
  )}% (${loaded}/${total})`;
  // console.log(areLoading, cached, item, formattedProgress);
  return [areLoading, formattedProgress, !basicResourcesMissing];
};
