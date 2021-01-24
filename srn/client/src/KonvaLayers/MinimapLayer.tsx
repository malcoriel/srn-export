import { useToggleHotkey } from '../utils/useToggleHotkey';
import { Arc, Circle, Group, Layer, Rect, Stage, Star } from 'react-konva';
import {
  crimson,
  darkGreen,
  dirtyGray,
  gray,
  mint,
  teal,
  yellow,
} from '../utils/palette';
import color from 'color';

import React, { useMemo, useState } from 'react';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import {
  height_units,
  radToDeg,
  unitsToPixels_min,
  width_units,
  size,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../world';
import Vector, { IVector, VectorF, VectorFzero } from '../utils/Vector';
import _ from 'lodash';
import { useRealToScreen, useScreenToReal } from '../coordHooks';
import {
  calcRealLenToScreenLen,
  calcRealPosToScreenPos,
  calcScreenLenToRealLen,
  calcScreenPosToRealPos,
} from '../coord';

export const minimap_proportion = 0.3;
export const inv_minimap_proportion = 1 / minimap_proportion;
export const get_minimap_size_x = () => size.getMinSize() * minimap_proportion;
export const get_minimap_size_y = () => size.getMinSize() * minimap_proportion;

export const minimap_scale = 0.1;

export const minimap_shift = 0.005;

const trailWidth = 0.5;
const baseOpacity = 0.6;
const innerOpacity = 0.5;
const planetOpacity = 0.9;
const totalArc = 45;
const arcCount = 9;

export const MinimapLayer = React.memo(() => {
  const ns = NetState.get();
  if (!ns) return null;

  const [shown] = useToggleHotkey('shift+m', true, 'show minimap');
  if (!shown) return null;

  useNSForceChange('MinimapLayer');

  const { state, visualState } = ns;
  let { cameraPosition } = visualState;

  const {
    screenLenToRealLen,
    screenPosToRealPos,
    realLenToScreenLen,
    realPosToScreenPos,
  } = useMemo(() => {
    let world_size = VectorF(width_units, height_units);
    let minimap_size = new Vector(get_minimap_size_x(), get_minimap_size_y());
    const realLenToScreenLen = calcRealLenToScreenLen(world_size, minimap_size);
    const realPosToScreenPos = calcRealPosToScreenPos(
      VectorFzero,
      world_size,
      minimap_size
    );
    const screenLenToRealLen = calcScreenLenToRealLen(world_size, minimap_size);
    const screenPosToRealPos = calcScreenPosToRealPos(
      VectorFzero,
      world_size,
      minimap_size
    );
    return {
      screenLenToRealLen,
      screenPosToRealPos,
      realLenToScreenLen,
      realPosToScreenPos,
    };
  }, [get_minimap_size_x(), get_minimap_size_y()]);

  const minimap_viewport_size_x =
    realLenToScreenLen(viewPortSizeMeters().x) / visualState.zoomShift;
  const minimap_viewport_size_y =
    realLenToScreenLen(viewPortSizeMeters().y) / visualState.zoomShift;

  // let moveCamera = (dragEvent: any) => {
  //   const mouseEvent = dragEvent.evt as any;
  //   let currentPosition = new Vector(mouseEvent.layerX, mouseEvent.layerY);
  //   visualState.boundCameraMovement = false;
  //   let currentPositionUV = new Vector(
  //     currentPosition.x / get_minimap_size_x() - 0.5,
  //     currentPosition.y / get_minimap_size_y() - 0.5
  //   );
  //   visualState.cameraPosition = currentPositionUV.scale(width_units);
  // };
  const myShip = findMyShip(state);
  return (
    <Stage
      width={get_minimap_size_x()}
      height={get_minimap_size_y()}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 10,
        border: `solid ${teal} 1px`,
        borderWidth: '0 0 1px 1px',
        borderRadius: 5,
      }}
    >
      <Layer>
        <Rect
          width={get_minimap_size_x()}
          height={get_minimap_size_y()}
          fill={gray}
          opacity={baseOpacity}
          // onMouseDown={moveCamera}
          //zIndex={1}
        />
        {state.star && (
          <Circle
            key={state.star.id}
            opacity={planetOpacity}
            // onMouseDown={moveCamera}
            radius={realLenToScreenLen(state.star.radius) * 0.6}
            fill={state.star.color}
            position={realPosToScreenPos(state.star)}
          />
        )}
        {state.planets &&
          state.planets.map((p, i) => {
            let anchorPos = state.star
              ? Vector.fromIVector(state.star)
              : VectorF(0, 0);
            let pPos = Vector.fromIVector(p);
            let orbitDist = realLenToScreenLen(pPos.euDistTo(anchorPos));
            let angleRad = pPos.angleRad(anchorPos.add(VectorF(1, 0)));
            let negativeRotation = p.orbit_speed < 0;
            let arcDirMultiplier = 1;
            if (negativeRotation) {
              arcDirMultiplier = -1;
            }

            let rotationDeg = radToDeg(angleRad);
            let b = p.radius;
            let a = pPos.euDistTo(anchorPos);
            let beta = Math.acos((2 * a * a - b * b) / (2 * a * a));

            const arcCommonProps = {
              angle: totalArc / arcCount,
              innerRadius: orbitDist - trailWidth / 0.5,
              outerRadius: orbitDist + trailWidth / 0.5,
              fill: p.color,
              strokeWidth: 1,
              position: realPosToScreenPos(anchorPos),
            };
            return (
              <Group key={p.id ? p.id : i}>
                <Group position={realPosToScreenPos(p)}>
                  <Circle
                    opacity={planetOpacity}
                    radius={realLenToScreenLen(p.radius)}
                    fill={p.color}
                    stroke={mint}
                    strokeWidth={0.5}
                    // onMouseDown={moveCamera}
                  />
                </Group>
                {p.anchor_tier === 1 && (
                  <Group>
                    {_.times(arcCount, (i) => {
                      return (
                        <Arc
                          // onMouseDown={moveCamera}
                          key={i}
                          {...arcCommonProps}
                          rotation={
                            (pPos.y < 0 ? -rotationDeg : rotationDeg) +
                            (negativeRotation ? -totalArc : 0) +
                            // shift for the planet radius
                            radToDeg(beta) +
                            // shift for every arc part
                            (i * totalArc) / arcCount
                          }
                          opacity={
                            negativeRotation
                              ? innerOpacity * (i * (1 / arcCount))
                              : innerOpacity * (1 - i * (1 / arcCount))
                          }
                        />
                      );
                    })}
                  </Group>
                )}
              </Group>
            );
          })}
        {state.asteroid_belts.map((b) => (
          <Arc
            key={b.id}
            angle={360}
            innerRadius={realLenToScreenLen(b.radius - b.width / 2)}
            outerRadius={realLenToScreenLen(b.radius + b.width / 2)}
            fill={dirtyGray}
            opacity={0.4}
            position={realPosToScreenPos(VectorF(0, 0))}
          />
        ))}
        {state.ships.map((s) => {
          const pos = realPosToScreenPos(s);
          const isMy = myShip && s.id === myShip.id;
          return (
            <Star
              key={s.id}
              x={pos.x}
              y={pos.y}
              innerRadius={realLenToScreenLen(s.radius * 8)}
              outerRadius={realLenToScreenLen(s.radius + 15)}
              fill={isMy ? crimson : mint}
              stroke="black"
              strokeWidth={0.5}
              numPoints={5}
              opacity={0.8}
            />
          );
        })}
        <Rect
          width={minimap_viewport_size_x}
          height={minimap_viewport_size_y}
          fill={color(yellow).alpha(0.2).string()}
          stroke="white"
          strokeWidth={1}
          draggable
          // onDragMove={moveCamera}
          position={realPosToScreenPos(cameraPosition).subtract(
            new Vector(minimap_viewport_size_x, minimap_viewport_size_y).scale(
              0.5
            )
          )}
        />
      </Layer>
    </Stage>
  );
});
