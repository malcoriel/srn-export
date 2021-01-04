import React, { Suspense, useRef, useState } from 'react';
import './DialoguePanel.scss';

import { Canvas, MouseEvent, useFrame } from 'react-three-fiber';
import { Vector3 } from 'three';
import {
  CAMERA_DEFAULT_ZOOM,
  CAMERA_HEIGHT,
} from '../ThreeLayers/CameraControls';
import { BackgroundPlane } from '../ThreeLayers/BackgroundPlane';
import { max_x, min_x, Planet } from '../world';
import { ThreePlanetShape } from '../ThreeLayers/ThreePlanetShape';
import NetState, { findMyShip } from '../NetState';
import { findPlanet } from './GameHTMLHudLayer';
import { posToThreePos } from '../ThreeLayers/ThreeLayer';
import _ from 'lodash';

function Box(props: any) {
  // This reference will give us direct access to the mesh
  const mesh: any = useRef();

  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  // Rotate mesh every frame, this is outside of React without overhead
  useFrame(() => {
    mesh.current.rotation.x = mesh.current.rotation.y += 0.01;
  });

  return (
    <mesh
      {...props}
      ref={mesh}
      scale={active ? [1.5, 1.5, 1.5] : [1, 1, 1]}
      onClick={(event: any) => setActive(!active)}
      onPointerOver={(event: any) => setHover(true)}
      onPointerOut={(event: any) => setHover(false)}
    >
      <boxBufferGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} />
    </mesh>
  );
}

export const DialoguePanel: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const { state } = ns;

  const myShip = findMyShip(state);
  if (!myShip) return null;
  if (!myShip.docked_at) return null;

  const planet = findPlanet(state, myShip.docked_at);

  if (!planet) return null;

  return (
    <div className="dialogue panel-base">
      <div className="top-part">
        <div className="left-character">
          <img src="TODO" alt="TODO" />
        </div>
        <div className="scene">
          <Canvas
            style={{ width: 200, height: 200, backgroundColor: 'black' }}
            orthographic
            camera={{
              position: new Vector3(0, 0, CAMERA_HEIGHT),
              zoom: CAMERA_DEFAULT_ZOOM() * 0.5,
            }}
          >
            <ambientLight />
            <pointLight position={[10, 10, 10]} />
            <ThreePlanetShape
              key={planet.id}
              scale={
                _.times(3, () => planet.radius) as [number, number, number]
              }
              color={planet.color}
            />
          </Canvas>
        </div>
        <div className="right-character">
          <img src="TODO" alt="TODO" />
        </div>
      </div>
      <div className="prompt">
        You find yourself in a trading hub of <span className="elem">qwe</span>{' '}
        planet. It's time to pick up your cargo!
      </div>
      <div className="options">
        <div className="line">1. Get the cargo.</div>
        <div className="line">2. Go away.</div>
      </div>
    </div>
  );
};
