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

export const useShapeGeometry = ({
  vertices,
}: {
  vertices: Vector[];
  shift?: Vector;
}): BufferGeometry => {
  return useMemo(() => {
    const shape = new THREE.Shape();
    // shape.moveTo(25, 25);
    // shape.lineTo(25, 25);
    // shape.bezierCurveTo(25, 25, 20, 0, 0, 0);
    // shape.bezierCurveTo(-30, 0, -30, 35, -30, 35);
    // shape.bezierCurveTo(-30, 55, -10, 77, 25, 95);
    // shape.bezierCurveTo(60, 77, 80, 55, 80, 35);
    // shape.bezierCurveTo(80, 35, 80, 0, 50, 0);
    // shape.bezierCurveTo(35, 0, 25, 25, 25, 25);

    shape.moveTo(0, 0);
    for (const point of vertices) {
      shape.lineTo(point.x, -point.y);
    }
    return new THREE.ShapeGeometry(shape);
  }, [vertices]);
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
  const geometry = useShapeGeometry({
    vertices: [
      VectorF(100, 100),
      VectorF(100, -100),
      VectorF(-100, -100),
      VectorF(-100, 100),
      VectorF(100, 100),
    ],
  });
  return (
    <mesh geometry={geometry} scale={2}>
      <meshBasicMaterial color="blue" />
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
