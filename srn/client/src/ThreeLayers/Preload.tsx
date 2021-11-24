import { Billboard, Html, Preload } from '@react-three/drei';
import { Canvas, useLoader } from '@react-three/fiber';
import React, { MutableRefObject, Suspense, useEffect } from 'react';
import * as THREE from 'three';
import { AudioLoader, FileLoader, TextureLoader } from 'three';
import { explosionSfxFull } from './blocks/ThreeExplosion';
import { useResourcesLoading } from '../utils/useResourcesLoading';
import ReactDOM from 'react-dom';
import classNames from 'classnames';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
const STLLoader = require('three-stl-loader')(THREE);

THREE.Cache.enabled = true;

export const usePreload = (paths: string[]) => {
  useEffect(() => {
    (async () => {
      // await pMap(
      //   paths,
      //   async (path) => {
      //     try {
      //       const loader = makeLoaderFn(path);
      //       console.log(`preloading ${path}...`);
      //       const content = await loader();
      //       console.log(`done preloading ${path}.`);
      //       THREE.Cache.add(`/${path}`, content);
      //     } catch (e: any) {
      //       let atStack = '';
      //       if (e.stack) {
      //         atStack += ` at ${e.stack}`;
      //       }
      //       console.error(`error preloading ${path}: ${e}${atStack}`);
      //     }
      //   },
      //   { concurrency: PRELOAD_CONCURRENCY }
      // );
    })();
  }, [paths]);
};
const promisify = <TArgs extends Array<any>, TRes>(
  fn: (...args: TArgs) => TRes,
  thisArg?: any,
  threeLoaderInterface?: boolean
) => (...args: TArgs) =>
  new Promise<TRes>((res, rej) => {
    const nodeStyleCallback = (err: any, ...results: any[]) => {
      if (err) {
        rej(err);
        return;
      }
      if (results.length && results.length === 1) {
        res(results[0] as TRes);
      } else {
        res((results as any) as TRes);
      }
    };
    const threeStyleCallbacks = [
      // onLoad
      (data: any) => {
        res(data);
      },
      // onProgress
      undefined,
      (error: any) => {
        rej(error);
      },
    ];
    if (!threeLoaderInterface) {
      args.push(nodeStyleCallback);
    } else {
      args.push(...threeStyleCallbacks);
    }
    fn.apply(thisArg, args);
  });

export const Preloader: React.FC = () => {
  useLoader(AudioLoader, explosionSfxFull);
  useLoader(STLLoader, 'resources/models/ship.stl');
  useLoader(TextureLoader, [
    'resources/bowling_grass.jpg',
    'resources/lavatile.png',
  ]);
  // @ts-ignore
  window.threeCache = THREE.Cache;
  // use drei's eager loading
  return <Preload all />;
};

export const SuspendedHtmlPreloader: React.FC = () => {
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
        <Preloader />
      </Suspense>
    </Canvas>
  );
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
        <Preloader />
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

export const PRELOAD_CONCURRENCY = 4;
export type loaderFn = () => Promise<ArrayBuffer>;
const makeLoaderFn = (path: string): loaderFn => {
  return async () => {
    const loader = new FileLoader();
    loader.setMimeType(navigator.mimeTypes['application/octet-stream' as any]);
    const content = await loader.loadAsync(path);
    return content as ArrayBuffer;
  };
};
export const preloadPaths = [
  'resources/models/ship.stl',
  'resources/bowling_grass.jpg',
  'resources/lavatile.png',
  ...explosionSfxFull,
];
