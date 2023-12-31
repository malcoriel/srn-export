import { Html, Preload, useProgress } from '@react-three/drei';
import { Canvas, useLoader } from '@react-three/fiber';
import React, { Suspense, useEffect } from 'react';
import * as THREE from 'three';

// noinspection ES6ConvertRequireIntoImport
const { preloadFont } = require('troika-three-text').exports;
import { AudioLoader, TextureLoader } from 'three';
import { explosionSfxFull } from './blocks/ThreeExplosion';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { GameMode } from '../../../world/pkg/world.extra';
import { useNSForceChange } from '../NetStateHooks';

const STLLoader = require('three-stl-loader')(THREE);

THREE.Cache.enabled = true;

const allSounds = [...explosionSfxFull];

const allStlModels = ['resources/models/ship.stl'];
const allGltfModels = [
  'resources/models/container.glb',
  'resources/models/asteroid.glb',
];

export const possibleGasGiantColors = [
  '#0D57AC',
  '#AE213D',
  '#DE4C0A',
  '#05680D',
  '#01A6A0',
  '#9D91A1',
  '#AA6478',
  '#4D56A5',
  '#382C4F',
  '#AC54AD',
  '#8D948D',
  '#A0B472',
  '#C7B4A6',
  '#1D334A',
  '#5BBAA9',
  '#008FA9',
  '#ADBEA3',
  '#F5B0A1',
  '#A1A70B',
  '#025669',
  '#AE2460',
  '#955802',
  '#9C46B8',
  '#DE019B',
  '#DC890C',
  '#F68923',
  '#F4A261',
  '#E76F51',
  '#849324',
  '#FD151B',
  '#D8A47F',
  '#EF8354',
];

const allTextures = [
  'resources/bowling_grass.jpg',
  'resources/lavatile.png',
  ...possibleGasGiantColors.map((color) => {
    const key = color.replace('#', '').toUpperCase();

    return `resources/textures/gas-giants/${key}.png`;
  }),
];

const allFonts = [
  'resources/fonts/DejaVuSans.ttf',
  'https://fonts.gstatic.com/s/roboto/v18/KFOmCnqEu92Fr1Mu4mxM.woff',
];

const preloadPaths = [...allStlModels, ...allTextures, ...allSounds];

const PreloaderImpl: React.FC = () => {
  useLoader(AudioLoader, allSounds);
  useLoader(STLLoader, allStlModels);
  useLoader(TextureLoader, allTextures);
  useLoader(GLTFLoader, allGltfModels);

  useEffect(() => {
    preloadFont({});
  });
  // @ts-ignore
  window.threeCache = THREE.Cache;
  // use drei's eager in-memory loading
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

/*
 * The drei/useLoader is buggy, and the authors refuse to fix it: https://github.com/pmndrs/drei/issues/314
 * As a workaround, I've discovered that if I force-async (via setTimeout(0)) execute their hooks,
 * the bug will disappear. It seems that it should've been an effect, but they failed to write it correctly
 * */
const patchUseProgressBug = () => {
  const originalMethods: Record<string, any> = {};

  function patchMethod(methodName: string) {
    // @ts-ignore
    originalMethods[methodName] = THREE.DefaultLoadingManager[methodName];
    // @ts-ignore
    THREE.DefaultLoadingManager[methodName] = (...args: any[]) => {
      setTimeout(() => {
        if (originalMethods[methodName]) {
          // @ts-ignore
          originalMethods[methodName].apply(THREE.DefaultLoadingManager, args);
        }
      }, 0);
    };
  }

  patchMethod('onStart');
  patchMethod('onError');
  patchMethod('onLoad');
  patchMethod('onProgress');
};

export const useResourcesLoading = (): [boolean, string, boolean] => {
  const { total, loaded, active } = useProgress();
  patchUseProgressBug();
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

function renderLoadingIndicator(miniMode: boolean, text: string) {
  return (
    <div
      className={classNames({
        'three-loader': true,
        playing: miniMode,
      })}
    >
      <div className="loader ball-clip-rotate-multiple">
        <div />
        <div />
      </div>
      <div className="text">{text}</div>
    </div>
  );
}

const useConnectingState = (desiredMode: GameMode) => {
  const {
    state: { id, mode },
    replay,
  } = useNSForceChange(
    'ThreeLoadingIndicator',
    false,
    (prev, next) => prev.id !== next.id
  ) || { state: {} };
  let connecting: boolean;
  if (!replay) {
    connecting = id === '' || mode !== desiredMode;
  } else {
    connecting = id === '';
  }
  return connecting;
};

export const ThreeLoadingIndicator: React.FC<{
  desiredMode: GameMode;
}> = React.memo(({ desiredMode }) => {
  const [
    resourcesAreLoading,
    formattedProgress,
    basicResourcesLoaded,
  ] = useResourcesLoading();
  const connecting = useConnectingState(desiredMode);
  const mountpoint = document.getElementById('main-container');
  if (!mountpoint) return null;

  const text = resourcesAreLoading
    ? `Loading: ${formattedProgress}`
    : 'Connecting to server...';
  const miniMode = basicResourcesLoaded && !connecting;
  return (
    <Suspense fallback={<mesh />}>
      <PreloaderImpl />
      {(resourcesAreLoading || connecting) && (
        <Html>
          {ReactDOM.createPortal(
            renderLoadingIndicator(miniMode, text),
            mountpoint
          )}
        </Html>
      )}
    </Suspense>
  );
});

export const MenuLoadingIndicator: React.FC = () => {
  const [resourcesAreLoading] = useResourcesLoading();
  const mountpoint = document.getElementById('main-container');
  if (!mountpoint || !resourcesAreLoading) return null;
  return ReactDOM.createPortal(renderLoadingIndicator(true, ''), mountpoint);
};
