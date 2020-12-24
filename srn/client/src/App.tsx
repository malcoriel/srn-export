import React, { Component, ReactNode, ReactNodeArray } from 'react';
import {
  Text,
  Stage,
  Layer,
  Rect,
  Circle,
  Shape,
  Transformer,
  KonvaNodeComponent,
  Arrow,
  Line,
} from 'react-konva';
import Konva from 'konva';
import useSWR, { SWRConfig } from 'swr';
import 'reset-css';
import './index.css';
import _ from 'lodash';

const width_px = 800;
const height_px = 800;
const width_units = 100;
const height_units = 100;
const max_x = 50;
const max_y = 50;
const min_x = -50;
const min_y = -50;

const DebugState = () => {
  const { data: state } = useSWR('http://localhost:8000/api/state');
  return (
    <div
      style={{
        position: 'absolute',
        overflowX: 'hidden',
        overflowY: 'auto',
        left: 5,
        bottom: 5,
        width: 300,
        height: 300,
        opacity: 0.5,
        border: 'solid gray 0.5px',
      }}
    >
      {JSON.stringify(state, null, 2)}
    </div>
  );
};

type WithId = {
  id: number;
};

type Vec2f64 = {
  x: number;
  y: number;
};

type GameObject = WithId &
  Vec2f64 & {
    rot: number;
    radius: number;
  };

type Planet = GameObject;

type Ship = GameObject;

type GameState = {
  planets: Planet[];
  ships: Ship[];
};

const scaleConfig = {
  scaleX: 8,
  scaleY: 8,
  offsetX: -50,
  offsetY: -50,
};

const antiScale = {
  scaleX: 1 / scaleConfig.scaleX,
  scaleY: 1 / scaleConfig.scaleY,
};

const PlanetsLayer = () => {
  const { data: state } = useSWR<GameState>('http://localhost:8000/api/state');
  if (!state) return null;
  const { planets } = state;
  return (
    <Layer>
      {planets.map((p) => {
        return (
          <Circle
            x={p.x}
            y={p.y}
            radius={p.radius}
            fill="red"
            border={0.1}
            opacity={0.5}
            shadowBlur={5}
          />
        );
      })}
    </Layer>
  );
};

const ShipsLayer = () => {
  const { data: state } = useSWR<GameState>('http://localhost:8000/api/state');
  if (!state) return null;
  const { ships } = state;

  return <Layer></Layer>;
};

const CoordLayer = () => {
  const numberPoints = _.times(4, (i) => 10 + i * 10);
  return (
    <Layer>
      <Arrow
        points={[0, min_y, 0, max_y]}
        pointerWidth={1}
        pointerLength={1}
        stroke="black"
        dash={[1, 0.5]}
        opacity={0.3}
        strokeWidth={0.1}
      />
      <Arrow
        points={[min_x, 0, max_x, 0]}
        pointerWidth={1}
        pointerLength={1}
        stroke="black"
        dash={[1, 0.5]}
        opacity={0.3}
        strokeWidth={0.1}
      />
      <Line
        points={[min_x, min_y, min_x, max_x]}
        stroke="black"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[min_x, min_y, max_x, min_y]}
        stroke="black"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[max_x, min_y, max_x, max_y]}
        stroke="black"
        opacity={0.3}
        strokeWidth={0.5}
      />
      <Line
        points={[max_x, max_y, min_x, max_y]}
        stroke="black"
        opacity={0.3}
        strokeWidth={0.5}
      />
      {numberPoints.map((p) => (
        <Text text={`${p}`} x={p} y={1} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text text={`${p}`} x={1} y={p} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text text={`-${p}`} x={1} y={-p} {...antiScale} />
      ))}
      {numberPoints.map((p) => (
        <Text text={`-${p}`} x={-p} y={1} {...antiScale} />
      ))}
    </Layer>
  );
};

class App extends Component {
  render() {
    return (
      <SWRConfig
        value={{
          refreshInterval: 1000,
          fetcher: (url, init) => fetch(url, init).then((res) => res.json()),
        }}
      >
        <>
          <div style={{ padding: 5 }}>
            <Stage width={width_px} height={height_px} {...scaleConfig}>
              <PlanetsLayer />
              <ShipsLayer />
              <CoordLayer />
            </Stage>
          </div>
          <DebugState />
        </>
      </SWRConfig>
    );
  }
}

export default App;
