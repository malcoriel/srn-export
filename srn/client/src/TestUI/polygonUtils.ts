import Vector, { VectorF } from '../utils/Vector';
import { AABB } from '../world';
import React from 'react';

export const segmentIntersectRaw = (
  p0_x: number,
  p0_y: number,
  p1_x: number,
  p1_y: number,
  p2_x: number,
  p2_y: number,
  p3_x: number,
  p3_y: number
): Vector | null => {
  const s1_x = p1_x - p0_x;
  const s1_y = p1_y - p0_y;
  const s2_x = p3_x - p2_x;
  const s2_y = p3_y - p2_y;
  const s =
    (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) /
    (-s2_x * s1_y + s1_x * s2_y);
  const t =
    (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) /
    (-s2_x * s1_y + s1_x * s2_y);
  // noinspection RedundantIfStatementJS
  if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
    return VectorF(p0_x + t * s1_x, p0_y + t * s1_y);
  }

  return null; // No collision
};

export const segmentIntersect = (
  x1: Vector,
  y1: Vector,
  x2: Vector,
  y2: Vector
): Vector | null => {
  return segmentIntersectRaw(x1.x, x1.y, y1.x, y1.y, x2.x, x2.y, y2.x, y2.y);
};

export const polygonIntersects = (
  shapeA: Vector[],
  shapeB: Vector[]
): Vector | null => {
  for (let i = 0; i < shapeA.length; i++) {
    const currA = shapeA[i];
    const nextA = shapeA[i + 1] || shapeA[0];
    for (let j = 0; j < shapeB.length; j++) {
      const currB = shapeB[i];
      const nextB = shapeB[j + 1] || shapeB[0];
      const intersectionFound = segmentIntersect(currA, nextA, currB, nextB);
      if (intersectionFound) return intersectionFound;
    }
  }
  return null;
};

// https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon
/** Get relationship between a point and a polygon using ray-casting algorithm
 * @param {{x:number, y:number}} P: point to check
 * @param {{x:number, y:number}[]} polygon: the polygon
 * @returns -1: outside, 0: on edge, 1: inside
 */
const relationPP = (P: Vector, polygon: Vector[]) => {
  const between = (p: number, a: number, b: number) =>
    (p >= a && p <= b) || (p <= a && p >= b);
  let inside = false;
  for (let i = polygon.length - 1, j = 0; j < polygon.length; i = j, j++) {
    const A = polygon[i];
    const B = polygon[j];
    // corner cases
    if ((P.x === A.x && P.y === A.y) || (P.x === B.x && P.y === B.y)) return 0;
    if (A.y === B.y && P.y === A.y && between(P.x, A.x, B.x)) return 0;

    if (between(P.y, A.y, B.y)) {
      // if P inside the vertical range
      // filter out "ray pass vertex" problem by treating the line a little lower
      if ((P.y === A.y && B.y >= A.y) || (P.y === B.y && A.y >= B.y)) continue;
      // calc cross product `PA X PB`, P lays on left side of AB if c > 0
      const c = (A.x - P.x) * (B.y - P.y) - (B.x - P.x) * (A.y - P.y);
      if (c === 0) return 0;
      if (A.y < B.y === c > 0) inside = !inside;
    }
  }

  return inside ? 1 : -1;
};

export const pointInsidePolygon = (
  point: Vector,
  polygon: Vector[]
): boolean => {
  const rel = relationPP(point, polygon);
  return rel === 1;
};

export const fullyInside = (outer: Vector[], inner: Vector[]): boolean => {
  const noIntersect = !polygonIntersects(outer, inner);
  const firstInside = pointInsidePolygon(inner[0], outer);
  return noIntersect && firstInside;
};

export enum GridType {
  Triangles,
}

type GeometricalGrid = {
  items: Vector[][];
  gridToReal: (i: number, j: number) => Vector;
  gridFlatToReal: (i: number) => Vector;
};

export const genGrid = (
  type: GridType,
  zero: Vector,
  bounds: AABB
): GeometricalGrid => {
  const items: Vector[][] = [];

  return {
    items,
    gridToReal: () => {
      return VectorF(0, 0);
    },
  };
};

export type ThreeTriangleProps = {
  position: Vector;
  rotationRad: number;
  sideSize: number;
  color: string;
};
