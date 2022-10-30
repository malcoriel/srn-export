import {
  circularItemsCount,
  genGrid,
  Grid,
  GridItem,
  GridType,
  pointInsidePolygon,
  polygonIntersects,
  segmentIntersect,
  segmentIntersectRaw,
} from './polygonUtils';
import { VectorF } from '../utils/Vector';

describe('polygonUtils', () => {
  it('can find segment intersections', () => {
    expect(segmentIntersectRaw(0, 0, 1, 1, 2, 2, 3, 3)).toEqual(null);
    expect(segmentIntersectRaw(0, 0, 1, 1, 1, 0, 0, 1)).toEqual({
      x: 0.5,
      y: 0.5,
    });
    expect(
      segmentIntersect(
        VectorF(0, 0),
        VectorF(1, 1),
        VectorF(2, 2),
        VectorF(3, 3)
      )
    ).toEqual(null);
  });

  it('can tell if polygons intersect', () => {
    expect(
      polygonIntersects(
        [VectorF(0, 0), VectorF(0, 1), VectorF(1, 1), VectorF(1, 0)],
        [VectorF(2, 2), VectorF(2, 3), VectorF(3, 3), VectorF(3, 2)]
      )
    ).toEqual(null);
    expect(
      polygonIntersects(
        [VectorF(0, 0), VectorF(0, 1), VectorF(1, 1), VectorF(1, 0)],
        [VectorF(0, 0), VectorF(2, 3), VectorF(3, 3), VectorF(3, 2)]
      )
    ).toBeTruthy();
  });

  it('can check if point is inside polygon', () => {
    expect(
      pointInsidePolygon(VectorF(0.5, 0.5), [
        VectorF(0, 0),
        VectorF(0, 1),
        VectorF(1, 1),
        VectorF(1, 0),
      ])
    ).toBeTruthy();

    expect(
      pointInsidePolygon(VectorF(1, 1), [
        VectorF(0, 0),
        VectorF(0, 1),
        VectorF(1, 1),
        VectorF(1, 0),
      ])
    ).toBeFalsy();
  });

  it('can check if one polygon is inside another', () => {
    expect(
      pointInsidePolygon(VectorF(0.5, 0.5), [
        VectorF(0, 0),
        VectorF(0, 1),
        VectorF(1, 1),
        VectorF(1, 0),
      ])
    ).toBeTruthy();

    expect(
      pointInsidePolygon(VectorF(1, 1), [
        VectorF(0, 0),
        VectorF(0, 1),
        VectorF(1, 1),
        VectorF(1, 0),
      ])
    ).toBeFalsy();
  });

  const genDummyGridItem = (id: number): GridItem & { id: number } => ({
    id,
    center: VectorF(0, 0),
    vertices: [],
  });

  it('can calculate circular grid items count', () => {
    expect(circularItemsCount(1)).toEqual(1);
    expect(circularItemsCount(2)).toEqual(8);
    expect(circularItemsCount(3)).toEqual(16);
    expect(circularItemsCount(4)).toEqual(24);
  });

  it('can unwrap coord into linear', () => {
    const grid = new Grid([], GridType.Triangles);
    expect(grid.coordToLinear(0, 0)).toEqual(0);
    expect(grid.coordToLinear(1, 0)).toEqual(1);
    expect(grid.coordToLinear(1, 1)).toEqual(2);
    expect(grid.coordToLinear(0, 1)).toEqual(3);
    expect(grid.coordToLinear(-1, 1)).toEqual(4);
    expect(grid.coordToLinear(-1, 0)).toEqual(5);
    expect(grid.coordToLinear(-1, -1)).toEqual(6);
    expect(grid.coordToLinear(0, -1)).toEqual(7);
    expect(grid.coordToLinear(1, -1)).toEqual(8);
    expect(grid.coordToLinear(2, 0)).toEqual(9);
    expect(grid.coordToLinear(2, 1)).toEqual(10);
  });

  xit('can unwrap linear into coord', () => {
    const grid = new Grid([], GridType.Triangles);
    expect(grid.linearToCoord(0)).toEqual({ i: 0, j: 0 });
    expect(grid.linearToCoord(1)).toEqual({ i: 1, j: 0 });
    expect(grid.linearToCoord(2)).toEqual({ i: 1, j: 1 });
  });

  xit('can generate a triangle grid', () => {
    const grid = genGrid(
      GridType.Triangles,
      VectorF(0, 0),
      {
        top_left: VectorF(-10, -10),
        bottom_right: VectorF(10, 10),
      },
      5
    );
    expect(grid.items.length).toBeGreaterThan(0);
    /*
    Triangle grid is like - y - direction is normal, and x
    creates alternating triangles in the x-direction, that
    stack to the nearest one:

    ____
    \/\/
     __
    /\/\
    ____
    \/\/
    */
    expect(grid.gridToReal(0, 0)).toEqual(VectorF(0, 0));
    expect(grid.gridToReal(0, 1)).toEqual(VectorF(0, 5));
  });
});
