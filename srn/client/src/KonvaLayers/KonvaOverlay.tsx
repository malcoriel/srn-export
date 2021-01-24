import Color from 'color';
import React, { useMemo } from 'react';
import { findMineral, GameState, TRACTOR_DIST } from '../world';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import { Circle, Layer, Text } from 'react-konva';
import Vector, { IVector } from '../utils/Vector';
import _ from 'lodash';
import { babyBlue, crimson, darkGreen } from '../utils/palette';
import Prando from 'prando';
import {
  calcRealPosToScreenPos,
  unitsToPixels_min,
  viewPortSizeMeters,
  viewPortSizePixels,
} from '../coord';
import { useStore } from '../store';

function extractNamePositions(
  state: GameState,
  cameraPosition: IVector,
  shiftPos: (inp: IVector) => IVector
): Array<[string, string, IVector, number]> {
  const res = [];
  for (const planet of state.planets) {
    let planetProps: [string, string, IVector, number] = [
      planet.id,
      planet.name,
      shiftPos(planet),
      unitsToPixels_min() * planet.radius + 30,
    ];
    res.push(planetProps);
  }

  if (state.star) {
    let items: [string, string, IVector, number] = [
      state.star.id,
      state.star.name,
      shiftPos(state.star),
      unitsToPixels_min() * state.star.radius * 0.7 + 30,
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
      unitsToPixels_min() * ship.radius + 30,
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
  shiftPos: (p: IVector) => IVector
): Array<VisualHpEffect> => {
  const res: VisualHpEffect[] = [];
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

  const shiftPos = useMemo(
    () =>
      calcRealPosToScreenPos(
        visualState.cameraPosition,
        viewPortSizeMeters(),
        viewPortSizePixels(),
        visualState.zoomShift
      ),
    [
      visualState.cameraPosition,
      viewPortSizeMeters(),
      viewPortSizePixels(),
      visualState.zoomShift,
    ]
  );

  const names = extractNamePositions(
    state,
    visualState.cameraPosition,
    shiftPos
  );

  const effects = extractEffectsPositions(
    state,
    visualState.cameraPosition,
    shiftPos
  );

  return (
    <Layer>
      {hintedMineral && (
        <>
          <Circle
            position={shiftPos(hintedMineral)}
            stroke={hintedMineral.color}
            strokeWidth={1}
            radius={hintedMineral.radius * unitsToPixels_min()}
          />
          {myShip && (
            <Circle
              radius={TRACTOR_DIST * unitsToPixels_min()}
              stroke="gray"
              strokeWidth={1}
              position={shiftPos(myShip)}
              dash={[1, 10]}
            />
          )}
        </>
      )}
      {names.map(([id, name, position, offsetY]) => {
        let textWidth = 70;
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
          />
        );
      })}
    </Layer>
  );
});
