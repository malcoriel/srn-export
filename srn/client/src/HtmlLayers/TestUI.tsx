import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './TestUI.scss';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Button } from './ui/Button';
import { Canvas, useThree } from 'react-three-fiber';
import { Vector3 } from 'three/src/math/Vector3';
import { extend } from 'react-three-fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  BufferGeometry,
  Color,
  Geometry,
  IcosahedronBufferGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshNormalMaterial,
  Scene,
  SphereBufferGeometry,
  SphereGeometry,
} from 'three';
extend({ OrbitControls });
import { CSG } from 'three-csg-ts';
import Prando from 'prando';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';
import { Input } from './ui/Input';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils';

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

export const TestUI: React.FC<{}> = () => {
  const [seed, setSeed] = useState('qqq');
  const [shown] = useToggleHotkey('ctrl+shift+t', true);
  const [scene, setScene] = useState(null as Scene | null);
  const [sceneMesh, setSceneMesh] = useState(null as Mesh | null);
  const gen = () => {
    let sc = scene as Scene;
    if (sceneMesh && scene) {
      const prng = new Prando(seed);
      let baseMesh: Mesh = sceneMesh;
      baseMesh.updateMatrix();

      for (let i = 0; i < 15; i++) {
        console.log(`iter ${i + 1}`);
        const baseCsg = CSG.fromMesh(baseMesh);
        const impactMesh = new Mesh(
          new IcosahedronBufferGeometry(prng.next(3, 6), 2)
        );
        const MAX_OUT = 21.5;
        const MIN_IN = 19.5;

        const theta = prng.next(0, Math.PI * 2);
        const v = prng.next(0, 1);
        const phi = Math.acos(2 * v - 1);
        const r = prng.next(MIN_IN, MAX_OUT);
        const x = r * Math.sin(phi) * Math.cos(theta);
        const y = r * Math.sin(phi) * Math.sin(theta);
        const z = r * Math.cos(phi);

        impactMesh.position.add(new Vector3(x, y, z));
        impactMesh.updateMatrix();
        // sc.add(impactMesh);
        const csg = CSG.fromMesh(impactMesh);
        const result = baseCsg.subtract(csg);
        const formed = CSG.toMesh(result, baseMesh.matrix);
        baseMesh.geometry = formed.geometry;
        baseMesh.updateMatrix();

        // @ts-ignore
        // baseMesh.geometry = new BufferGeometry().fromGeometry(
        //   baseMesh.geometry
        // );

        // const count = 10;
        // const modifer = new SimplifyModifier();
        // console.log(`simplifying ${count} iterations...`);
        // baseMesh.geometry = modifer.modify(baseMesh.geometry, count);
        // baseMesh.geometry = new Geometry().fromBufferGeometry(
        //   baseMesh.geometry
        // );
        //
        // baseMesh.geometry.computeVertexNormals();
        console.log('vertices', formed.geometry.vertices.length);
      }
      baseMesh.updateMatrix();

      // @ts-ignore
      baseMesh.geometry = new BufferGeometry().fromGeometry(baseMesh.geometry);
      let count = 500;
      const modifer = new SimplifyModifier();
      console.log(`simplifying ${count} iterations...`);
      baseMesh.geometry = modifer.modify(baseMesh.geometry, count);
      baseMesh.geometry = new Geometry().fromBufferGeometry(baseMesh.geometry);

      console.log('after simplifying', baseMesh.geometry.vertices.length);

      // let tolerance = 0.01;
      // console.log(`merging vertices with tolerance ${tolerance}...`);
      // baseMesh.geometry = BufferGeometryUtils.mergeVertices(
      //   new BufferGeometry().fromGeometry(baseMesh.geometry),
      //   tolerance
      // );
      // baseMesh.geometry = new Geometry().fromBufferGeometry(baseMesh.geometry);

      let material = new MeshNormalMaterial();
      material.flatShading = false;
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
    if (scene) {
      if (sceneMesh) {
        sc.remove(sceneMesh);
      }
      let material = new MeshBasicMaterial();
      material.color = new Color('pink');
      material.wireframe = true;
      let mesh = new Mesh(new IcosahedronBufferGeometry(20, 3), material);
      sc.add(mesh);
      setSceneMesh(mesh);
    }
  };

  useEffect(() => {
    reset();
  }, [scene]);

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
          <axesHelper args={[100]} />
          {/*<Extrusion*/}
          {/*  start={[25, 25]}*/}
          {/*  paths={[*/}
          {/*    [25, 25, 20, 0, 0, 0],*/}
          {/*    [30, 0, 30, 35, 30, 35],*/}
          {/*    [30, 55, 10, 77, 25, 95],*/}
          {/*  ]}*/}
          {/*  bevelEnabled*/}
          {/*  amount={8}*/}
          {/*/>*/}
          <OrbitControlsWrapper />
        </Suspense>
      </Canvas>

      <div
        style={{ position: 'absolute', height: '100%', right: 0, width: '20%' }}
      >
        <Input value={seed} onChange={(e) => setSeed(e.target.value)} />
        <Button onClick={gen}>Gen</Button>
        <Button onClick={reset}>Reset</Button>
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
