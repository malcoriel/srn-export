import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './TestUI.scss';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Button } from './ui/Button';
import { Canvas, useThree } from 'react-three-fiber';
import { Vector3 } from 'three/src/math/Vector3';
import { extend } from 'react-three-fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Color,
  Geometry,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereBufferGeometry,
  SphereGeometry,
} from 'three';
extend({ OrbitControls });
import { CSG } from 'three-csg-ts';
import Prando from 'prando';
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier';

const OrbitControlsWrapper = () => {
  const { camera } = useThree();
  // @ts-ignore
  return <orbitControls args={[camera, document.querySelector('.test-ui')]} />;
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
    console.log(sceneMesh);
    if (sceneMesh && scene) {
      const prng = new Prando(seed);
      let baseMesh: Mesh = sceneMesh;
      baseMesh.updateMatrix();

      for (let i = 0; i < 10; i++) {
        const baseCsg = CSG.fromMesh(baseMesh);
        let meshBasicMaterial = new MeshBasicMaterial();
        meshBasicMaterial.color = new Color('green');
        const impactMesh = new Mesh(
          new SphereGeometry(10, 6, 6),
          meshBasicMaterial
        );
        let x = prng.next(-20, 21);
        let y = prng.next(-20, 21);
        let z = prng.next(-20, 21);
        impactMesh.position.add(new Vector3(x, y, z));
        impactMesh.updateMatrix();
        //sc.add(impactMesh);
        const csg = CSG.fromMesh(impactMesh);
        const result = baseCsg.subtract(csg);
        const formed = CSG.toMesh(result, baseMesh.matrix);
        baseMesh.geometry = formed.geometry;
        baseMesh.updateMatrix();
      }

      const modifer = new SimplifyModifier();
      baseMesh.updateMatrix();
      let count = 10000;
      const simplified = modifer.modify(baseMesh.geometry, count);
      let meshBasicMaterial = new MeshBasicMaterial();
      meshBasicMaterial.wireframe = false;
      meshBasicMaterial.color = new Color('green');
      let mesh = new Mesh(
        new Geometry().fromBufferGeometry(simplified),
        meshBasicMaterial
      );
      mesh.updateMatrix();
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
      let mesh = new Mesh(new SphereBufferGeometry(20), material);
      sc.add(mesh);
      setSceneMesh(mesh);
    }
  };

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
        <input
          type="text"
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
        />
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
