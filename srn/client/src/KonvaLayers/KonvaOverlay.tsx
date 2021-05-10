import React from 'react';
import { Circle, Layer, Text } from 'react-konva';
import _ from 'lodash';
import Prando from 'prando';
import { findContainer, findMineral, GameState, TRACTOR_DIST } from '../world';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import Vector, { IVector } from '../utils/Vector';
import { crimson, darkGreen, rare, teal } from '../utils/palette';
import { useStore } from '../store';
import { useRealToScreen } from '../coordHooks';

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
  const shipsById = _.keyBy(state.locations[0].ships, 'id');

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
  const hintedContainer = hintedObjectId
    ? findContainer(ns.state, hintedObjectId)
    : undefined;

  const { state, visualState } = ns;
  const myShip = findMyShip(state);

  const { realLenToScreenLen, realPosToScreenPos } = useRealToScreen(ns);

  const effects = extractEffectsPositions(
    state,
    visualState.cameraPosition,
    realPosToScreenPos,
    realLenToScreenLen
  );

  const tractorDistanceCircle = myShip && (
    <Circle
      radius={realLenToScreenLen(TRACTOR_DIST)}
      stroke={teal}
      strokeWidth={1}
      position={realPosToScreenPos(myShip)}
      dash={[5, 10]}
    />
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
          {tractorDistanceCircle}
        </>
      )}
      {hintedContainer && (
        <>
          <Circle
            position={realPosToScreenPos(hintedContainer.position)}
            stroke={rare}
            strokeWidth={1}
            radius={realLenToScreenLen(hintedContainer.radius)}
          />
          {tractorDistanceCircle}
        </>
      )}
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
