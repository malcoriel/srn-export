import Vector, { VectorF } from '../utils/Vector';
import * as THREE from 'three';
import { BufferGeometry } from 'three';
import React, { useMemo } from 'react';
import { posToThreePos } from '../ThreeLayers/util';
import { genGrid, GridType, ThreeTriangleProps } from './polygonUtils';

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
export const useShapeGeometries = ({
  multiVertices,
  scale = 1.0,
}: {
  multiVertices: Vector[][];
  scale?: number;
}): BufferGeometry[] => {
  return useMemo(() => {
    const results = [];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    for (const vertices of multiVertices) {
      for (const point of vertices) {
        const point2 = point.scale(scale);
        shape.lineTo(point2.x, point2.y);
      }
      results.push(new THREE.ShapeGeometry(shape));
    }
    return results;
  }, [multiVertices, scale]);
};
export const useCustomGeometry = ({
  vertices,
  scale = 1.0,
  shift,
}: {
  vertices: Vector[];
  scale?: number;
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
export const useCustomGeometries = ({
  multiVertices,
  scale = 1.0,
  shift,
}: {
  multiVertices: Vector[][];
  scale?: number;
  shift?: Vector;
}): BufferGeometry[] => {
  const shiftedVertices = useMemo(() => {
    const result = [];
    for (const vertices of multiVertices) {
      const verticesUsed = [...vertices, vertices[0]];
      let shiftedVertices;
      if (shift) {
        shiftedVertices = verticesUsed.map((v) => v.add(shift));
      } else {
        shiftedVertices = verticesUsed;
      }
      result.push(shiftedVertices);
    }
    return result;
  }, [multiVertices, shift]);
  return useShapeGeometries({ multiVertices: shiftedVertices, scale });
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
  const geometry = useCustomGeometry({
    vertices: [
      VectorF(64, 64),
      VectorF(128, -128),
      VectorF(0, -64),
      VectorF(-128, -128),
      VectorF(-64, 64),
    ],
    shift: VectorF(0, 0),
  });
  return (
    <mesh geometry={geometry} position={[0, 0, -1]}>
      <meshBasicMaterial color="blue" />
    </mesh>
  );
};
export const TriangleGrid = () => {
  const grid = useMemo(
    () =>
      genGrid(
        GridType.Triangles,
        VectorF(0, 0),
        {
          top_left: VectorF(-10, 10),
          bottom_right: VectorF(10, -10),
        },
        10
      ),
    []
  );
  const geometry = useShapeGeometry({
    vertices: [VectorF(1, 0), VectorF(-1, 0), VectorF(0, Math.sqrt(3) * 2)],
  });
  return (
    <group>
      {grid.items.map((polygon, i) => {
        return (
          <mesh geometry={geometry}>
            <meshBasicMaterial color="green" wireframe />
          </mesh>
        );
      })}
    </group>
  );
};

export const ShipShapeGeneration = () => null;
