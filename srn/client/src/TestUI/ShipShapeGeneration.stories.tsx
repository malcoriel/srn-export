import React, { useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import * as THREE from 'three';
import { BufferGeometry } from 'three';
import Vector, { VectorF } from '../utils/Vector';
import { posToThreePos } from '../ThreeLayers/util';
import _ from 'lodash';

const ShipShapeGeneration = () => null;

export const useCustomGeometry = ({
  vertices,
  scale,
  shift,
}: {
  vertices: Vector[];
  scale: number;
  shift?: Vector;
}): BufferGeometry => {
  const triangleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    let shiftedVertices;
    if (shift) {
      shiftedVertices = vertices.map((v) => v.add(shift));
    } else {
      shiftedVertices = vertices;
    }
    const verticesUnpacked = shiftedVertices.reduce((acc, curr) => {
      const scaled = curr.scale(scale);
      return [...acc, ...posToThreePos(scaled.x, -scaled.y)];
    }, [] as number[]);
    const indices = _.times(vertices.length, (i) => i);

    console.log(verticesUnpacked, indices);

    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(verticesUnpacked, vertices.length)
    );
    geometry.setIndex(indices);
    return geometry;
  }, [scale, vertices, shift]);
  return triangleGeometry;
};

export type ThreeTriangleProps = {
  position: Vector;
  rotationRad: number;
  sideSize: number;
  color: string;
};

export const ThreeTriangle: React.FC<ThreeTriangleProps> = ({
  position,
  color,
  rotationRad,
  sideSize,
}) => {
  const height = Math.sin(Math.PI / 3) / 2;
  const triangleGeometry = useCustomGeometry({
    scale: sideSize,
    vertices: [
      VectorF(-1 / 2, 0),
      VectorF(1 / 2, 0),
      VectorF(0, Math.sin(Math.PI / 3)),
    ],
    shift: VectorF(0, -height),
  });
  return (
    <mesh
      geometry={triangleGeometry}
      position={posToThreePos(position.x, position.y)}
      rotation={[0, 0, rotationRad]}
    >
      <meshBasicMaterial color={color} />
    </mesh>
  );
};

export const ThreeInterceptorOutline = () => {
  const geometry = useCustomGeometry({
    vertices: [
      VectorF(100, 100),
      VectorF(100, -100),
      VectorF(-100, -100),
      VectorF(-100, 100),
    ],
    scale: 1.0,
  });
  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial color="blue" wireframe/>
    </mesh>
  );
};

const Template: Story = (args) => {
  const [revision, setRevision] = useState(uuid.v4());
  useEffect(() => {
    setRevision((old) => old + 1);
  }, []);
  return (
    <div>
      <StoryCanvas scale={2.0} withRuler>
        <ThreeSpaceBackground
          key={`${revision}+${JSON.stringify(args)}`}
          shaderShift={args.shift}
          size={512}
        />
        <ThreeTriangle
          sideSize={100}
          position={VectorF(0, 0)}
          rotationRad={0.0}
          color="red"
        />
        <ThreeInterceptorOutline />
      </StoryCanvas>
    </div>
  );
};

export const Main = Template.bind({});
Main.args = {};

export default {
  title: 'Three/ShipShapeGeneration',
  component: ShipShapeGeneration,
  argTypes: {},
} as Meta;
