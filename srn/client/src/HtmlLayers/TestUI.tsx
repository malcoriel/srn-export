import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import './TestUI.scss';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Button } from './ui/Button';
import { Canvas, MouseEvent, useThree } from 'react-three-fiber';
import { Vector3 } from 'three/src/math/Vector3';
import { extend } from 'react-three-fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as THREE from 'three';
import {
  Color,
  Geometry,
  Mesh,
  MeshBasicMaterial,
  Scene,
  SphereGeometry,
} from 'three';
import _ from 'lodash';
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
  const [scene, setScene] = useState(null);
  const meshRef = useRef();
  const gen = () => {
    // @ts-ignore
    let sc = scene as Scene;
    if (meshRef.current && scene) {
      const prng = new Prando(seed);
      // @ts-ignore
      let baseMesh: Mesh = meshRef.current;
      sc.getObjectById(baseMesh.id)!.remove();
      for (let i = 0; i < 10; i++) {
        console.log('start');
        console.log(sc.children.length);
        baseMesh.updateMatrix();
        const baseCsg = CSG.fromMesh(baseMesh);
        console.log('from mesh', sc.children.length);
        const impactMesh = new Mesh(new SphereGeometry(10, 6, 6));
        console.log('new mesh', sc.children.length);
        let x = prng.next(-20, 21);
        let y = prng.next(-20, 21);
        let z = prng.next(-20, 21);
        impactMesh.position.add(new Vector3(x, y, z));
        impactMesh.updateMatrix();
        const csg = CSG.fromMesh(impactMesh);
        console.log('from mesh 2', sc.children.length);
        const result = baseCsg.subtract(csg);
        const formed = CSG.toMesh(result, baseMesh.matrix);
        let objectById = sc.getObjectById(impactMesh.id);
        if (objectById) objectById.remove();
        console.log('remove 1', sc.children.length);
        // @ts-ignore
        formed.material.wireframe = true;
        let objectById2 = sc.getObjectById(baseMesh.id);
        if (objectById2) {
          console.log('removed');
          objectById2.remove();
        }
        console.log('remove 2', sc.children.length);
        sc.add(formed);
        console.log('add', sc.children.length);
        baseMesh = formed;
        console.log('end');
      }

      const modifer = new SimplifyModifier();
      const simplified = modifer.modify(
        baseMesh.geometry,
        // @ts-ignore
        baseMesh.geometry.vertices.length * 0.95
      );
      let meshBasicMaterial = new MeshBasicMaterial();
      meshBasicMaterial.wireframe = true;
      // sc.add(new Mesh(simplified, meshBasicMaterial));
      console.log(sc);
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
          <mesh ref={meshRef}>
            <sphereBufferGeometry args={[20]} />
            <meshToonMaterial
              opacity={1}
              color="pink"
              wireframe={true}
              alphaTest={0}
            />
          </mesh>
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
        {/*<Button>Reset</Button>*/}
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
