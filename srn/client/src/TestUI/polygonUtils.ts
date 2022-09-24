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

export type GeometricalGrid = {
  items: GridItem[];
  gridToReal: (i: number, j: number) => GridItem;
  type: GridType;
};

export type GridItem = {
  vertices: Vector[];
  center: Vector;
  id?: number;
};

/*
 * y = x > 1 ? (1 + 2 * (x - 2)) * 4 + 4 : 1
 * tier 1 = 1
 * tier 2 = 4 + (1 * 4) = 8
 * tier 3 = 4 + (3 * 4) = 16
 * tier 4 = 4 + (5 * 4) = 24
 * */
// given squares, how many items are on the x-th level of boundaries around a point?
// first it's the point itself, then 8 cells around it, then 16 around them, etc.
// tiers are 1-based, where 1 is the point itself
export const circularItemsCount = (tier: number) => {
  return tier > 1 ? (1 + 2 * (tier - 2)) * 4 + 4 : 1;
};

const calcItemsBeforeTier = (tier: number): number => {
  if (tier === 1 || tier === 0) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < tier - 1; i++) {
    total += circularItemsCount(i + 1);
  }
  return total;
};

export class Grid implements GeometricalGrid {
  // this grid uses circular layout of items into array, going counterclockwise
  // in mathematical coords (y up)
  // like the first element is at (0, 0), then (1, 0), then (1, 1), then (0, 1)
  constructor(public items: GridItem[], public type: GridType) {}

  public coordToLinear(i: number, j: number): number {
    if (i === 0 && j === 0) {
      return 0;
    }
    const tier = Math.max(Math.abs(i), Math.abs(j)) + 1;
    const itemsInTiersBefore = calcItemsBeforeTier(tier);
    const itemsInThisTier = circularItemsCount(tier);
    const octantItems = itemsInThisTier / 8; // after t1, it's always divisible by 8
    // console.log({octantItems, tier, itemsInTiersBefore});
    let shift = 0;
    if (i > 0 && j >= 0) {
      // Q1 excluding topmost
      if (i > j) {
        // O1 excluding top right
        shift = j;
      } else {
        // O2 excluding topmost
        shift = octantItems + (octantItems - i);
      }
    } else if (i <= 0 && j > 0) {
      // Q2 excluding leftmost
      if (Math.abs(i) < Math.abs(j)) {
        // O3 excluding top left
        shift = octantItems * 2 + (octantItems - i) - 1;
      } else {
        // O4 excluding leftmost
        shift = octantItems * 3 + (octantItems - j);
      }
    } else if (i < 0 && j <= 0) {
      // Q3 excluding bottommost
      if (Math.abs(i) > Math.abs(j)) {
        // O5 excluding bottom left
        shift = octantItems * 4 + (octantItems - j) - 1;
      } else {
        // O6 excluding bottommost
        shift = octantItems * 5 + (octantItems - i) - 2;
      }
    } else if (i >= 0 && j < 0) {
      // Q4 excluding rightmost
      if (Math.abs(i) < Math.abs(j)) {
        // O7 excluding bottom right
        shift = octantItems * 6 + (octantItems - i) - 1;
      } else {
        // O8 excluding rightmost
        shift = octantItems * 7 + (octantItems - j) - 2;
      }
    }
    return itemsInTiersBefore + shift;
  }

  public gridToReal(i: number, j: number): GridItem {
    const index = this.coordToLinear(i, j);
    const item = this.items[index];
    if (!item) {
      throw new Error(`No item at ${i}/${j}`);
    }
    return item;
  }
}

export const genGrid = (
  type: GridType,
  zero: Vector,
  bounds: AABB,
  itemSize: number
): GeometricalGrid => {
  const items: GridItem[] = [];
  return new Grid(items, type);
};

export type ThreeTriangleProps = {
  position: Vector;
  rotationRad: number;
  sideSize: number;
  color: string;
};
