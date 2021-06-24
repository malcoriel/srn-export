import React, { Suspense } from 'react';
import NetState, { useNSForceChange } from '../NetState';
import { Window } from './ui/Window';
import './LeaderboardWindow.scss';
import { Vector3 } from 'three';
import { CAMERA_HEIGHT } from '../ThreeLayers/CameraControls';
import { Canvas } from 'react-three-fiber';
import { StarMap } from './StarMap';
import { LongActionStartBuilder } from '../../../world/pkg/world.extra';
import { useStore, WindowState } from '../store';

export const StarMapWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const setMapWindow = useStore((s) => s.setMapWindow);

  useNSForceChange('StarMapWindow', false, (prevState, nextState) => {
    return prevState.locations[0].id !== nextState.locations[0].id;
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
            <StarMap
              size={600}
              systems={locations}
              links={links}
              onSystemClick={(id) => {
                ns.startLongAction(
                  LongActionStartBuilder.LongActionStartTransSystemJump({
                    to: id,
                  })
                );
                setMapWindow(WindowState.Hidden);
              }}
            />
          </group>
        </Suspense>
      </Canvas>
    </Window>
  );
};
