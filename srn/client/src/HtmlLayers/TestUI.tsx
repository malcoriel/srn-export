import React, { Suspense } from 'react';
import './TestUI.scss';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Button } from './ui/Button';
import { Canvas, MouseEvent, useThree } from 'react-three-fiber';
import { Vector3 } from 'three/src/math/Vector3';
import { extend } from 'react-three-fiber';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
extend({ OrbitControls });

const OrbitControlsWrapper = () => {
  const { camera } = useThree();
  // @ts-ignore
  return <orbitControls args={[camera, document.querySelector('.test-ui')]} />;
};

export const TestUI: React.FC<{}> = () => {
  const [shown] = useToggleHotkey('ctrl+shift+t', true);
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
          <ambientLight />
          <axesHelper args={[100]} />
          <mesh>
            <sphereBufferGeometry args={[5]} />
            <meshBasicMaterial color="darkgreen" />
          </mesh>
          <OrbitControlsWrapper />
        </Suspense>
      </Canvas>

      <div
        style={{ position: 'absolute', height: '100%', right: 0, width: '20%' }}
      >
        <Button>Reset</Button>
        <Button>Undo</Button>
        <Button>Redo</Button>
        <Button>Add part X-</Button>
        <Button>Add part X+</Button>
        <Button>Add part Y-</Button>
        <Button>Add part Y+</Button>
        <Button>Add part Z-</Button>
        <Button>Add part Z+</Button>
        <Button>ScaleX</Button>
        <Button>ScaleY</Button>
        <Button>ScaleZ</Button>
      </div>
    </div>
  ) : null;
};
