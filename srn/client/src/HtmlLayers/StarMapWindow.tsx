import React, { Suspense } from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { Window } from './ui/Window';
import './LeaderboardWindow.scss';
import { Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { Canvas } from 'react-three-fiber';
import { StarMap } from './StarMap';

export const StarMapWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('StarMapWindow', false, (prevState, nextState) => {
    return (
      JSON.stringify(prevState.locations) !==
      JSON.stringify(nextState.locations)
    );
  });

  const { locations } = ns.state;
  if (!locations) {
    return null;
  }

  const links = [];
  for (const loc of locations) {
    for (const adj of loc.adjacent_location_ids) {
      links.push({ from: loc.id, to: adj });
    }
  }

  return (
    <Window
      width={600}
      height={600}
      thickness={8}
      line="thick"
      contentClassName="leaderboard-window-content"
      storeKey="mapWindow"
    >
      <Canvas
        orthographic
        gl={{ preserveDrawingBuffer: true }}
        camera={{
          position: new Vector3(0, 0, CAMERA_HEIGHT + 100),
          zoom: 1.0,
          far: 1000,
        }}
        style={{
          display: 'inline-block',
          width: '100%',
          height: '100%',
        }}
      >
        <Suspense fallback={<mesh />}>
          <ambientLight />
          <pointLight position={[0, 0, CAMERA_HEIGHT]} />
          <group position={[0, 0, 0]}>
            <StarMap systems={locations} links={links} />
          </group>
        </Suspense>
      </Canvas>
    </Window>
  );
};
