import { Html, Preload, useProgress } from '@react-three/drei';
import { Canvas, useLoader } from '@react-three/fiber';
import React, { Suspense } from 'react';
import * as THREE from 'three';
import { AudioLoader, TextureLoader } from 'three';
import { explosionSfxFull } from './blocks/ThreeExplosion';
import ReactDOM from 'react-dom';
import classNames from 'classnames';

const STLLoader = require('three-stl-loader')(THREE);

THREE.Cache.enabled = true;

const allSounds = [...explosionSfxFull];

const allStlModels = ['resources/models/ship.stl'];

const allTextures = ['resources/bowling_grass.jpg', 'resources/lavatile.png'];

const preloadPaths = [...allStlModels, ...allTextures, ...allSounds];

const PreloaderImpl: React.FC = () => {
  useLoader(AudioLoader, allSounds);
  useLoader(STLLoader, allStlModels);
  useLoader(TextureLoader, allTextures);
  // @ts-ignore
  window.threeCache = THREE.Cache;
  // use drei's eager loading
  return <Preload all />;
};

export const SuspendedPreloader: React.FC = () => {
  return (
    <Canvas
      style={{
        visibility: 'hidden',
        position: 'absolute',
        zIndex: -100,
        width: 1,
        height: 1,
      }}
    >
      <Suspense fallback={<mesh />}>
        <PreloaderImpl />
      </Suspense>
    </Canvas>
  );
};

export const useResourcesLoading = () => {
  const { total, loaded, active } = useProgress();
  const missingResources = new Set(preloadPaths);
  for (const res of Object.keys(THREE.Cache.files)) {
    missingResources.delete(res);
  }
  const basicResourcesMissing = missingResources.size > 0;
  // active property can lie and just means 'downloads in progress'
  const areLoading = active || basicResourcesMissing;
  const formattedProgress = `${Math.floor((loaded / total) * 100 || 0).toFixed(
    0
  )}% (${loaded}/${total})`;
  return [areLoading, formattedProgress, !basicResourcesMissing];
};
export const SuspendedThreeLoader: React.FC<{ playing: boolean }> = React.memo(
  ({ playing }) => {
    const [
      resourcesAreLoading,
      formattedProgress,
      basicResourcesLoaded,
    ] = useResourcesLoading();

    const mountpoint = document.getElementById('main-container');
    if (!mountpoint) return null;
    return (
      <Suspense fallback={<mesh />}>
        <PreloaderImpl />
        {resourcesAreLoading && (
          <Html>
            {ReactDOM.createPortal(
              <div
                className={classNames({
                  'three-loader': true,
                  playing: basicResourcesLoaded,
                })}
              >
                <div className="loader ball-clip-rotate-multiple">
                  <div />
                  <div />
                </div>
                <div className="text">Loading: {formattedProgress}</div>
              </div>,
              mountpoint
            )}
          </Html>
        )}
      </Suspense>
    );
  }
);
