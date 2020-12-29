import React from 'react';
import { Stage } from 'react-konva';
import 'reset-css';
import './index.css';
import { DebugStateLayer } from './DebugStateLayer';
import { height_px, scaleConfig, width_px } from './world';
import { CoordLayer } from './CoordLayer';
import { BodiesLayer } from './BodiesLayer';
import { ShipsLayer } from './ShipsLayer';
import NetState from './NetState';
import { ShipControls } from './ShipControls';
import { GameHTMLHudLayer } from './GameHTMLHudLayer';
import { useRef, useState } from 'react';
import { Canvas, MeshProps, useFrame, useLoader } from 'react-three-fiber';
import { Mesh, Vector3, TextureLoader } from 'three';

import {
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';
import { Measure, Perf, statsHeap, StatsPanel } from './Perf';
import { BasicTime, vsyncedDecoupledTime as Time } from './Times';
import { StartHudLayer } from './StartHudLayer';
import { LeaderboardLayer } from './LeaderboardLayer';

const LOCAL_SIM_TIME_STEP = Math.floor(1000 / 30);

statsHeap.timeStep = LOCAL_SIM_TIME_STEP;

const Sphere: React.FC<MeshProps> = (props) => {
  // This reference will give us direct access to the mesh
  const mesh = useRef<Mesh>();
  const space01map = useLoader(TextureLoader, 'resources/space01.jpg');
  console.log(space01map);
  // Set up state for the hovered and active state
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  useFrame(() => {
    if (mesh.current) mesh.current.rotation.z = mesh.current.rotation.z += 0.01;
  });

  return (
    <mesh
      {...props}
      ref={mesh}
      scale={[50, 50, 50]}
      onClick={(event: any) => setActive(!active)}
      onPointerOver={(event: any) => setHover(true)}
      onPointerOut={(event: any) => setHover(false)}
    >
      <icosahedronBufferGeometry args={[1, 5]} />
      <meshStandardMaterial
        color={hovered ? 'hotpink' : 'orange'}
        map={space01map}
      />
    </mesh>
  );
};

class Srn extends React.Component<
  {},
  { preferredName: string; ready: boolean }
> {
  private NS: NetState;
  private time: BasicTime;
  constructor(props: {}) {
    super(props);
    this.time = new Time(LOCAL_SIM_TIME_STEP);
    const NS = new NetState();
    NS.on('change', () => {
      this.forceUpdate();
    });
    NS.on('network', () => {
      this.forceUpdate();
    });
    this.NS = NS;
    this.state = {
      ready: true,
      preferredName: uniqueNamesGenerator({
        dictionaries: [adjectives, animals],
        separator: '-',
      }).toUpperCase(),
    };
    this.start();
  }

  start() {
    this.NS.preferredName = this.state.preferredName;
    this.NS.connect();
    Perf.start();
    this.time.setInterval(
      (elapsedMs) => {
        Perf.markEvent(Measure.PhysicsFrameEvent);
        Perf.usingMeasure(Measure.PhysicsFrameTime, () => {
          this.NS.updateLocalState(elapsedMs);
        });
      },
      () => {
        Perf.markEvent(Measure.RenderFrameEvent);
        Perf.usingMeasure(Measure.RenderFrameTime, () => {
          this.NS.emit('change');
        });
      }
    );
  }

  render() {
    return (
      <>
        <div style={{ padding: 5, position: 'relative' }}>
          {this.state.ready && (
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <BodiesLayer state={this.NS.state} />
              <ShipsLayer state={this.NS.state} />
              <CoordLayer />
              <ShipControls />
            </Stage>
          )}
          {this.state.ready && (
            <Canvas
              orthographic
              camera={{
                position: new Vector3(0, 100, 0),
                // rotation: [
                //   -Math.PI / 4,
                //   Math.atan(-1 / Math.sqrt(2)),
                //   0,
                //   'YXZ',
                // ],
              }}
              style={{
                position: 'absolute',
                top: 5,
                left: width_px + 5,
                backgroundColor: 'gray',
                width: width_px,
                height: height_px,
              }}
            >
              <ambientLight />
              <pointLight position={[10, 10, 10]} />
              {/*<Box position={[0, 0, 0]} />*/}
              <Sphere position={[0, 0, 0]} />
              <Sphere position={[100, 0, 0]} />
              <axesHelper args={[100]} position={[0, 0, 0]} />
            </Canvas>
          )}
          {/* blue is third coord (z?) */}
          {/* green is second  coord (y?) */}
          {/* red is first  coord (x?) */}
          <GameHTMLHudLayer
            state={this.NS.state}
            ping={this.NS.ping}
            maxPing={this.NS.maxPing}
            connecting={this.NS.connecting}
          />
        </div>
        {!this.state.ready && (
          <StartHudLayer
            onPreferredNameChange={(name) =>
              this.setState({ preferredName: name })
            }
            onGo={() => {
              this.setState({ ready: true });
              this.start();
            }}
            preferredName={this.state.preferredName}
          />
        )}
        {this.NS.state.leaderboard && (
          <LeaderboardLayer
            leaderboard={this.NS.state.leaderboard}
            milliseconds_remaining={this.NS.state.milliseconds_remaining}
          />
        )}
        <DebugStateLayer state={this.NS.state} />
        <StatsPanel />
      </>
    );
  }
}

export default Srn;
