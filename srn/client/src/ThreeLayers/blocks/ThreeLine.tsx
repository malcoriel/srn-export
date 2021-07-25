import * as React from 'react';
import { Color, Vector2 } from 'three';
import { ReactThreeFiber } from '@react-three/fiber';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry';
import {
  LineMaterial,
  LineMaterialParameters,
} from 'three/examples/jsm/lines/LineMaterial';
import { Line2 } from 'three/examples/jsm/lines/Line2';

export type ThreeLineProps = {
  points: Array<[number, number, number]>;
  color?: Color | string | number;
  vertexColors?: Array<Color | [number, number, number]>;
  lineWidth?: number;
  resolution: Vector2;
} & Omit<ReactThreeFiber.Object3DNode<Line2, typeof Line2>, 'args'> &
  Omit<
    ReactThreeFiber.Object3DNode<LineMaterial, [LineMaterialParameters]>,
    'color' | 'vertexColors' | 'resolution' | 'args'
  >;

export const ThreeLine = React.forwardRef<Line2, ThreeLineProps>(function Line(
  {
    resolution,
    points,
    color = 'black',
    vertexColors,
    lineWidth,
    dashed,
    ...rest
  },
  ref
) {
  const [line2] = React.useState(() => new Line2());
  const [lineMaterial] = React.useState(() => new LineMaterial());

  const lineGeom = React.useMemo(() => {
    const geom = new LineGeometry();
    geom.setPositions(points.map((p) => p).flat());

    if (vertexColors) {
      const cValues = vertexColors.map((c) => {
        return c instanceof Color ? c.toArray() : c;
      });
      geom.setColors(cValues.flat());
    }

    return geom;
  }, [points, vertexColors]);
  React.useLayoutEffect(() => {
    line2.computeLineDistances();
  }, [points, line2]);

  React.useLayoutEffect(() => {
    if (dashed) {
      lineMaterial.defines.USE_DASH = '';
    } else {
      // Setting lineMaterial.defines.USE_DASH to undefined is apparently not sufficient.
      delete lineMaterial.defines.USE_DASH;
    }
    lineMaterial.resolution = resolution;
    lineMaterial.needsUpdate = true;
  }, [dashed, lineMaterial, resolution]);

  return (
    <primitive dispose={undefined} object={line2} ref={ref} {...rest}>
      <primitive dispose={undefined} object={lineGeom} attach="geometry" />
      <primitive
        dispose={undefined}
        object={lineMaterial}
        attach="material"
        color={color}
        vertexColors={Boolean(vertexColors)}
        resolution={resolution}
        linewidth={lineWidth}
        dashed={dashed}
        {...rest}
      />
    </primitive>
  );
});
