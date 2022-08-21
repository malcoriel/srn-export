import React, { useEffect, useMemo, useState } from 'react';
import { Meta, Story } from '@storybook/react';
import * as uuid from 'uuid';
import { StoryCanvas } from './StoryCanvas';
import { ThreeSpaceBackground } from '../ThreeLayers/ThreeSpaceBackground';
import * as THREE from 'three';
import { BufferGeometry } from 'three';
import Vector, { VectorF } from '../utils/Vector';
import { posToThreePos } from '../ThreeLayers/util';

const ShipShapeGeneration = () => null;

export const useShapeGeometry = ({
  vertices,
  scale = 1.0,
}: {
  vertices: Vector[];
  scale?: number;
}): BufferGeometry => {
  return useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (const point of vertices) {
      const point2 = point.scale(scale);
      shape.lineTo(point2.x, point2.y);
    }
    return new THREE.ShapeGeometry(shape);
  }, [vertices, scale]);
};

export const useCustomGeometry = ({
  vertices,
  scale,
  shift,
}: {
  vertices: Vector[];
  scale: number;
  shift?: Vector;
}): BufferGeometry => {
  const shiftedVertices = useMemo(() => {
    const verticesUsed = [...vertices, vertices[0]];
    let shiftedVertices;
    if (shift) {
      shiftedVertices = verticesUsed.map((v) => v.add(shift));
    } else {
      shiftedVertices = verticesUsed;
    }
    return shiftedVertices;
  }, [vertices, shift]);
  return useShapeGeometry({ vertices: shiftedVertices, scale });
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
  const height = Math.sin(Math.PI / 3) / 3;
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
    <mesh geometry={geometry} position={[0, 0, -1]}>
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
