import React, { Suspense, useEffect, useState } from 'react';
import './TestUI.scss';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Button } from './ui/Button';
import { Canvas, extend, useLoader, useThree } from 'react-three-fiber';
import { Vector3 } from 'three/src/math/Vector3';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BoxBufferGeometry,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Geometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  Scene,
} from 'three';
import { CSG } from 'three-csg-ts';
import Prando from 'prando';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { Input } from './ui/Input';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';
import { ColladaExporter } from 'three/examples/jsm/exporters/ColladaExporter';
import { ThreeRock } from '../ThreeLayers/ThreeRock';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

extend({ OrbitControls });

const randNormal = (prng: Prando): number => {
  let u = 0,
    v = 0;
  while (u === 0) u = prng.next(0, 1); //Converting [0,1) to (0,1)
  while (v === 0) v = prng.next(0, 1);
  let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  num = num / 10.0 + 0.5; // Translate to 0 -> 1
  if (num > 1 || num < 0) return randNormal(prng); // resample between 0 and 1
  return num;
};

const OrbitControlsWrapper = () => {
  const { camera } = useThree();
  return (
    // @ts-ignore
    <orbitControls args={[camera, document.querySelector('.test-ui canvas')]} />
  );
};

const SceneHook = ({ setScene }: { setScene: any }) => {
  const { scene } = useThree();
  useEffect(() => {
    setScene(scene);
  }, []);
  return null;
};

const simplifyGeometry = (baseMesh: Mesh<Geometry>) => {
  // @ts-ignore
  baseMesh.geometry = new BufferGeometry().fromGeometry(baseMesh.geometry);
  const modifer = new SimplifyModifier();
  // @ts-ignore
  const numVertices = baseMesh.geometry.attributes.position.count;
  let count1 = Math.floor(numVertices * 0.05);
  console.log(`simplifying ${count1} iterations...`);

  let tmp = modifer.modify(baseMesh.geometry, count1);
  baseMesh.geometry = new Geometry().fromBufferGeometry(tmp);
};

let isReset = false;

const mergeVertices = (baseMesh: Mesh<Geometry>, tolerance: number = 1) => {
  console.log(`merging vertices with tolerance ${tolerance}...`);
  const merged = BufferGeometryUtils.mergeVertices(
    new BufferGeometry().fromGeometry(baseMesh.geometry),
    tolerance
  );
  baseMesh.geometry = new Geometry().fromBufferGeometry(merged);
};

function getSphereCoords(prng: Prando, MIN_IN: number, MAX_OUT: number) {
  const theta = prng.next(0, Math.PI * 2);
  const v = prng.next(0, 1);
  const phi = Math.acos(2 * v - 1);
  const r = prng.next(MIN_IN, MAX_OUT);
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.sin(phi) * Math.sin(theta);
  const z = r * Math.cos(phi);
  return { x, y, z };
}

const BoxModel = () => {
  const edges = new EdgesGeometry(new BoxBufferGeometry());
  const material = new LineBasicMaterial({ color: 0xff0000, linewidth: 5 });

  return (
    <group position={[0, 0, 0]} scale={[10, 10, 10]}>
      <mesh position={[0, 0, 0]} scale={[0.9999, 0.9999, 0.9999]}>
        <boxBufferGeometry />
        <meshBasicMaterial color="gray" />
      </mesh>
      <lineSegments args={[edges, material]} />
    </group>
  );
};

export const TestUI: React.FC<{}> = () => {
  const [seed, setSeed] = useState('qwe');
  const [shown] = useToggleHotkey('ctrl+shift+t', false);
  const [scene, setScene] = useState(null as Scene | null);
  const [sceneMesh, setSceneMesh] = useState(null as Mesh | null);
  const [link, setLink] = useState(null as HTMLAnchorElement | null);
  const gen = () => {
    let sc = scene as Scene;
    if (sceneMesh && scene) {
      isReset = false;
      const prng = new Prando(seed);
      // @ts-ignore
      let baseMesh: Mesh<Geometry> = sceneMesh;
      baseMesh.updateMatrix();
      const MAX_OUT = 21.5;
      const MIN_IN = 19.5;

      const existingPos: [Vector3, number][] = [];
      for (let i = 0; i < 20; i++) {
        console.log(`iter ${i + 1}`);
        const baseCsg = CSG.fromMesh(baseMesh);
        let radius = prng.next(30, 45);
        const impactMesh = new Mesh(
          new BoxBufferGeometry(radius, radius, radius)
        );

        // const { x, y, z } = getSphereCoords(prng, MIN_IN, MAX_OUT);

        let selectorOfNonZero = prng.next(0, 3);

        let x =
          selectorOfNonZero < 1
            ? prng.next(MIN_IN, MAX_OUT) * (prng.nextBoolean() ? 1 : -1)
            : (randNormal(prng) - 0.5) * 3 * MAX_OUT;
        let y =
          selectorOfNonZero >= 1 && selectorOfNonZero < 2
            ? prng.next(MIN_IN, MAX_OUT) * (prng.nextBoolean() ? 1 : -1)
            : (randNormal(prng) - 0.5) * 3 * MAX_OUT;
        let z =
          selectorOfNonZero >= 2 && selectorOfNonZero < 3
            ? prng.next(MIN_IN, MAX_OUT) * (prng.nextBoolean() ? 1 : -1)
            : (randNormal(prng) - 0.5) * 3 * MAX_OUT;

        let vector3 = new Vector3(x, y, z);

        // let shouldSkip = false;
        // for (const pair of existingPos) {
        //   const [exPos, exRad] = pair;
        //   if (exPos.distanceTo(vector3) < (exRad + radius) / 2) {
        //     console.log('skipping too close');
        //     shouldSkip = true;
        //     break;
        //   }
        // }
        // if (shouldSkip) {
        //   continue;
        // }

        existingPos.push([vector3.clone(), radius]);
        impactMesh.position.add(vector3);
        impactMesh.updateMatrix();
        // sc.add(impactMesh);
        const csg = CSG.fromMesh(impactMesh);
        const result = baseCsg.union(csg);
        const formed = CSG.toMesh(result, baseMesh.matrix);
        baseMesh.geometry = formed.geometry;
        baseMesh.updateMatrix();

        // mergeVertices(baseMesh, 0.0001);

        console.log('vertices', formed.geometry.vertices.length);
      }
      baseMesh.updateMatrix();

      // simplifyGeometry(baseMesh);

      console.log('after simplifying', baseMesh.geometry.vertices.length);

      // mergeVertices(baseMesh);

      let material = new MeshNormalMaterial();
      console.log('done', baseMesh.geometry.vertices.length);

      let mesh = new Mesh(baseMesh.geometry, material);
      mesh.updateMatrix();
      mesh.geometry.computeVertexNormals();
      sc.remove(baseMesh);
      sc.add(mesh);
      setSceneMesh(mesh);
    }
  };

  const reset = () => {
    let sc = scene as Scene;
    if (isReset) {
      return;
    }
    if (scene) {
      if (sceneMesh) {
        sc.remove(sceneMesh);
      }
      isReset = true;
      let material = new MeshBasicMaterial();
      material.color = new Color('pink');
      material.wireframe = true;
      let mesh = new Mesh(new BoxBufferGeometry(40, 40, 40), material);
      sc.add(mesh);
      setSceneMesh(mesh);
    }
  };

  const wireframe = new MeshBasicMaterial();
  wireframe.color = new Color('pink');
  wireframe.wireframe = true;

  const normal = new MeshNormalMaterial();
  normal.flatShading = true;

  const normalSmooth = new MeshNormalMaterial();
  normalSmooth.flatShading = false;

  const toggleMaterial = () => {
    if (sceneMesh) {
      if (sceneMesh.material === wireframe) {
        sceneMesh.material = normal;
      } else if (sceneMesh.material === normal) {
        sceneMesh.material = normalSmooth;
      } else if (sceneMesh.material === normalSmooth) {
        sceneMesh.material = wireframe;
      } else {
        sceneMesh.material = wireframe;
      }
    }
  };

  const exportModel = () => {
    if (sceneMesh) {
      const exporter = new ColladaExporter();
      sceneMesh.material = wireframe;
      const data = exporter.parse(sceneMesh, (json) => {}, {});
      if (!data) {
        return;
      }
      const blob = new Blob([data.data]);
      if (link) {
        link.href = URL.createObjectURL(blob);
        // @ts-ignore
        link.download = `${seed}.dae`;
        link.click();
      }
    }
  };

  // useEffect(() => {
  //   reset();
  //   const link = document.createElement('a');
  //   link.style.display = 'none';
  //   document.body.appendChild(link);
  //   setLink(link);
  // }, [scene]);

  return shown ? (
    <div className="test-ui">
      <Canvas
        camera={{
          position: new Vector3(50, 50, 50),
          far: 1000,
        }}
        style={{
          position: 'absolute',
          height: '100%',
          width: '80%',
          border: 'solid blue 1px',
        }}
      >
        {/* red is first  coord (x) */}
        {/* green is second  coord (y) */}
        {/* blue is third coord (z) */}
        <Suspense fallback={<mesh />}>
          <SceneHook setScene={setScene} />
          <ambientLight />
          {/*<axesHelper args={[100]} />*/}
          <OrbitControlsWrapper />
          <BoxModel />
          {/*<ThreeRock position={new Vector3(0, 0, 0)} />*/}
        </Suspense>
      </Canvas>

      <div
        style={{ position: 'absolute', height: '100%', right: 0, width: '20%' }}
      >
        {/*<Input value={seed} onChange={(e) => setSeed(e.target.value)} />*/}
        {/*<Button*/}
        {/*  onClick={() => {*/}
        {/*    reset();*/}
        {/*    setTimeout(gen, 100);*/}
        {/*  }}*/}
        {/*>*/}
        {/*  Gen*/}
        {/*</Button>*/}
        {/*<Button onClick={reset}>Reset</Button>*/}
        {/*<Button onClick={toggleMaterial}>Material</Button>*/}
        {/*<Button onClick={exportModel}>Export</Button>*/}
        {/*<Button>Undo</Button>*/}
        {/*<Button>Redo</Button>*/}
        {/*<Button onClick={addPart}>Add part X-</Button>*/}
        {/*<Button>Add part X+</Button>*/}
        {/*<Button>Add part Y-</Button>*/}
        {/*<Button>Add part Y+</Button>*/}
        {/*<Button>Add part Z-</Button>*/}
        {/*<Button>Add part Z+</Button>*/}
        {/*<Button>ScaleX</Button>*/}
        {/*<Button>ScaleY</Button>*/}
        {/*<Button>ScaleZ</Button>*/}
      </div>
    </div>
  ) : null;
};
