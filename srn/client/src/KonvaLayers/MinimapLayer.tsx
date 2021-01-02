import React, { useState } from 'react';
import NetState from '../NetState';
import { Arc, Circle, Group, Layer, Line, Rect } from 'react-konva';
import {
  degToRad,
  height_units,
  Planet,
  radToDeg,
  width_px,
  width_units,
} from '../world';
import { yellow } from '../utils/palette';
import Vector, { IVector, VectorF } from '../utils/Vector';
import _ from 'lodash';

export const minimap_proportion = 0.3;
export const minimap_size = width_px * minimap_proportion;
export const minimap_scale = 0.1;
export const minimap_viewport_size = minimap_size * minimap_scale;
export const minimap_shift = 0.005;

const posToMinimapPos = (pos: IVector) =>
  new Vector(
    (pos.x / width_units + 0.5) * minimap_size,
    (pos.y / height_units + 0.5) * minimap_size
  );

const radiusToMinimapRadius = (val: number) => val * minimap_scale * 2;

function orbitDistance(p: Planet) {
  return 10.0;
}

const trailWidth = 0.5;

export const MinimapLayer = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state, visualState } = ns;
  let { cameraPosition } = visualState;
  let cameraPositionUV = Vector.fromIVector({
    x: cameraPosition.x / width_units + 0.5 - minimap_scale / 2,
    y: cameraPosition.y / height_units + 0.5 - minimap_scale / 2,
  });
  // for some mystic reason, having setDragPosition forces synchronization
  const [, setDragPosition] = useState(cameraPositionUV);
  return (
    <Layer>
      {state.star && (
        <Circle
          radius={radiusToMinimapRadius(state.star.radius)}
          fill={state.star.color}
          position={posToMinimapPos(state.star)}
        />
      )}
      {state.planets &&
        state.planets.map((p) => {
          let anchorPos = state.star
            ? Vector.fromIVector(state.star)
            : VectorF(0, 0);
          let pPos = Vector.fromIVector(p);
          let orbitDist = radiusToMinimapRadius(pPos.euDistTo(anchorPos));
          let angleRad = pPos.angleRad(anchorPos.add(VectorF(1, 0)));
          let rotationDeg = radToDeg(angleRad);
          let b = p.radius;
          let a = pPos.euDistTo(anchorPos);
          let beta = Math.acos((2 * a * a - b * b) / (2 * a * a));
          // console.log({ id: p.id, beta: radToDeg(beta), radius: b });
          const arcCommonProps = {
            angle: 15,
            innerRadius: orbitDist + p.radius / 16 - trailWidth / 0.5,
            outerRadius: orbitDist + p.radius / 16 + trailWidth / 0.5,
            fill: p.color,
            strokeWidth: 1,
            position: posToMinimapPos(anchorPos),
          };
          return (
            <Group>
              <Group position={posToMinimapPos(p)}>
                <Circle
                  key={p.id}
                  radius={radiusToMinimapRadius(p.radius)}
                  fill={p.color}
                />
              </Group>
              {p.anchor_tier === 1 && (
                <Group>
                  {_.times(3, (i) => (
                    <Arc
                      key={i}
                      {...arcCommonProps}
                      rotation={
                        (pPos.y < 0 ? -rotationDeg : rotationDeg) +
                        radToDeg(beta) +
                        i * 15
                      }
                      opacity={0.3 - i * 0.1}
                    />
                  ))}
                </Group>
              )}
            </Group>
          );
        })}
      <Rect
        width={minimap_viewport_size}
        height={minimap_viewport_size}
        fill={yellow}
        opacity={0.3}
        draggable
        onDragMove={(dragEvent) => {
          const mouseEvent = dragEvent.evt as any;
          let currentPosition = new Vector(
            mouseEvent.layerX,
            mouseEvent.layerY
          );
          visualState.boundCameraMovement = false;
          let currentPositionUV = new Vector(
            currentPosition.x / minimap_size - 0.5,
            currentPosition.y / minimap_size - 0.5
          );
          setDragPosition(currentPositionUV);
          visualState.cameraPosition = currentPositionUV.scale(width_units);
        }}
        position={cameraPositionUV.scale(minimap_size)}
      />
    </Layer>
  );
};
