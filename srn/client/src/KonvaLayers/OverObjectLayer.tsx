import React from 'react';
import {
  antiScale,
  GameState,
  height_units,
  scaleConfig,
  unitsToPixels_min,
  width_units,
} from '../world';
import NetState, { useNSForceChange } from '../NetState';
import { Layer, Text } from 'react-konva';
import Vector, { IVector, VectorF } from '../utils/Vector';
import _ from 'lodash';
import { babyBlue, crimson, darkGreen } from '../utils/palette';
import Prando from 'prando';

export const calcShiftPos = (cameraPosition: IVector, zoomProp: number) => {
  const cameraShift = Vector.fromIVector(cameraPosition);
  return (objPos: IVector, offsetY = 0) => {
    const pos = Vector.fromIVector(objPos);
    return pos
      .subtract(cameraShift)
      .add(VectorF(0, offsetY))
      .scale(1 / zoomProp);
  };
};

export const halfWidthHeight = new Vector(width_units / 2, height_units / 2);

export const calcScreenPosToRealPos = (
  cameraPosition: IVector,
  zoomProp: number
) => {
  const cameraShift = Vector.fromIVector(cameraPosition);
  return (screenPos: IVector, offsetY = 0) => {
    return Vector.fromIVector(screenPos)
      .subtract(halfWidthHeight)
      .add(cameraShift.scale(unitsToPixels_min()))
      .subtract(VectorF(0, offsetY));
  };
};

function extractNamePositions(
  state: GameState,
  cameraPosition: IVector,
  zoomProp: number
): Array<[string, string, IVector, number]> {
  const res = [];
  const shiftPos = calcShiftPos(cameraPosition, zoomProp);
  for (const planet of state.planets) {
    let planetProps: [string, string, IVector, number] = [
      planet.id,
      planet.name,
      shiftPos(planet),
      planet.radius,
    ];
    res.push(planetProps);
  }

  if (state.star) {
    let items: [string, string, IVector, number] = [
      state.star.id,
      state.star.name,
      shiftPos(state.star, 15),
      state.star.radius,
    ];
    res.push(items);
  }

  const shipsById = _.keyBy(state.ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    let ship = shipsById[player.ship_id];
    if (!ship) {
      continue;
    }
    let starNamePos = shiftPos(ship);
    let shipProps: [string, string, IVector, number] = [
      ship.id,
      player.name,
      starNamePos,
      ship.radius,
    ];
    res.push(shipProps);
  }
  return res;
}

type VisualHpEffect = {
  id: string; // ship-id_effect_id
  text: string;
  opacity: number; // 0-1
  is_heal: boolean;
  position: IVector;
  offset: IVector;
};

const EFFECT_VISUAL_DURATION_MS = 3000;
const VIS_EFFECT_MOVE_SPEED = 0.05;

const extractEffectsPositions = (
  state: GameState,
  cameraPosition: IVector,
  zoomProp: number
): Array<VisualHpEffect> => {
  const res: VisualHpEffect[] = [];
  const shiftPos = calcShiftPos(cameraPosition, zoomProp);
  const shipsById = _.keyBy(state.ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    let ship = shipsById[player.ship_id];
    if (!ship || ship.hp_effects.length === 0) {
      continue;
    }

    let namePos = shiftPos(ship);

    res.push(
      ...ship.hp_effects.map((e) => {
        let age = Math.abs(state.ticks - e.tick);
        let opacity =
          age > EFFECT_VISUAL_DURATION_MS
            ? 0.0
            : (EFFECT_VISUAL_DURATION_MS - age) / EFFECT_VISUAL_DURATION_MS;
        let rng = new Prando(e.id);
        return {
          id: e.id,
          text: String(Math.abs(e.hp)),
          opacity,
          is_heal: e.hp > 0,
          offset: new Vector(
            rng.next(-50, 50),
            rng.next(-75, 25) + age * VIS_EFFECT_MOVE_SPEED
          ),

          position: namePos,
        };
      })
    );
  }
  return res;
};

export const OverObjectLayer: React.FC = React.memo(() => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('OverObjectLayer', true);

  const { state, visualState } = ns;
  let zoomProp = 1 / (visualState.zoomShift || 1.0);

  const names = extractNamePositions(
    state,
    visualState.cameraPosition,
    zoomProp
  );

  const effects = extractEffectsPositions(
    state,
    visualState.cameraPosition,
    zoomProp
  );

  return (
    <Layer>
      {names.map(([id, name, position, radius]) => {
        let textWidth = 300;
        return (
          <Text
            key={id}
            text={name}
            position={position}
            fill={babyBlue}
            align="center"
            offsetY={
              (scaleConfig().scaleY / zoomProp) * radius -
              scaleConfig().offsetY / 2
            }
            width={textWidth}
            offsetX={textWidth / 2}
            {...antiScale()}
          />
        );
      })}
      {effects.map((visHpEffect) => {
        let textWidth = 10;
        return (
          <Text
            key={visHpEffect.id}
            text={visHpEffect.text}
            position={visHpEffect.position}
            fill={visHpEffect.is_heal ? darkGreen : crimson}
            align="center"
            opacity={visHpEffect.opacity}
            offsetY={visHpEffect.offset.y}
            width={textWidth}
            offsetX={textWidth / 2 + visHpEffect.offset.x}
            {...antiScale()}
          />
        );
      })}
    </Layer>
  );
});
