import React from 'react';
import { Circle, Layer, Text } from 'react-konva';
import _ from 'lodash';
import Prando from 'prando';
import { findMineral, GameState, TRACTOR_DIST } from '../world';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import Vector, { IVector } from '../utils/Vector';
import { babyBlue, crimson, darkGreen, teal } from '../utils/palette';
import { useStore } from '../store';
import { useRealToScreen } from '../coordHooks';

function extractNamePositions(
  state: GameState,
  cameraPosition: IVector,
  shiftPos: (inp: IVector) => IVector,
  shiftLen: (len: number) => number
): Array<[string, string, IVector, number]> {
  const res = [];
  for (const planet of state.planets) {
    const planetProps: [string, string, IVector, number] = [
      planet.id,
      planet.name,
      shiftPos(planet),
      shiftLen(planet.radius) + 30,
    ];
    res.push(planetProps);
  }

  if (state.star) {
    const items: [string, string, IVector, number] = [
      state.star.id,
      state.star.name,
      shiftPos(state.star),
      (shiftLen(state.star.radius) + 30) * 0.7,
    ];
    res.push(items);
  }

  const shipsById = _.keyBy(state.ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    const ship = shipsById[player.ship_id];
    if (!ship) {
      continue;
    }
    const starNamePos = shiftPos(ship);
    const shipProps: [string, string, IVector, number] = [
      ship.id,
      player.name,
      starNamePos,
      shiftLen(ship.radius) + 30,
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
  shiftPos: (p: IVector) => IVector,
  _shiftLen: (len: number) => number
): Array<VisualHpEffect> => {
  const res: VisualHpEffect[] = [];
  const shipsById = _.keyBy(state.ships, 'id');

  for (const player of state.players) {
    if (!player.ship_id) {
      continue;
    }
    const ship = shipsById[player.ship_id];
    if (!ship || ship.hp_effects.length === 0) {
      continue;
    }

    const namePos = shiftPos(ship);

    res.push(
      ...ship.hp_effects.map((e) => {
        const age = Math.abs(state.ticks - e.tick);
        const opacity =
          age > EFFECT_VISUAL_DURATION_MS
            ? 0.0
            : (EFFECT_VISUAL_DURATION_MS - age) / EFFECT_VISUAL_DURATION_MS;
        const rng = new Prando(e.id);
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

export const KonvaOverlay: React.FC = React.memo(() => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('KonvaOverlay', true);
  const hintedObjectId = useStore((state) => state.hintedObjectId);
  const hintedMineral = hintedObjectId
    ? findMineral(ns.state, hintedObjectId)
    : undefined;

  const { state, visualState } = ns;
  const myShip = findMyShip(state);

  const { realLenToScreenLen, realPosToScreenPos } = useRealToScreen(ns);

  const names = extractNamePositions(
    state,
    visualState.cameraPosition,
    realPosToScreenPos,
    realLenToScreenLen
  );

  const effects = extractEffectsPositions(
    state,
    visualState.cameraPosition,
    realPosToScreenPos,
    realLenToScreenLen
  );

  return (
    <Layer>
      {hintedMineral && (
        <>
          <Circle
            position={realPosToScreenPos(hintedMineral)}
            stroke={hintedMineral.color}
            strokeWidth={1}
            radius={realLenToScreenLen(hintedMineral.radius)}
          />
          {myShip && (
            <Circle
              radius={realLenToScreenLen(TRACTOR_DIST)}
              stroke={teal}
              strokeWidth={1}
              position={realPosToScreenPos(myShip)}
              dash={[5, 10]}
            />
          )}
        </>
      )}
      {names.map(([id, name, position, offsetY]) => {
        const textWidth = 70;
        return (
          <Text
            key={id}
            text={name}
            position={position}
            fill={babyBlue}
            align="center"
            offsetY={offsetY}
            width={textWidth}
            offsetX={textWidth / 2}
          />
        );
      })}
      {effects.map((visHpEffect) => {
        const textWidth = 50;
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
          />
        );
      })}
    </Layer>
  );
});
