import React from 'react';
import { Circle, Layer, Text } from 'react-konva';
import Prando from 'prando';
import { GameState, TRACTOR_DIST } from '../world';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import Vector, { IVector } from '../utils/Vector';
import { crimson, darkGreen, rare, teal } from '../utils/palette';
import { useStore } from '../store';
import { useRealToScreen } from '../coordHooks';
import { UnreachableCaseError } from 'ts-essentials';

type VisLocalEffect = {
  id: string;
  text: string;
  opacity: number;
  color: string;
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
): Array<VisLocalEffect> => {
  const res: VisLocalEffect[] = [];

  for (const ship of state.locations[0].ships) {
    const namePos = shiftPos(ship);

    res.push(
      ...(ship.local_effects
        .map((e) => {
          if (e.tag === 'Unknown') {
            return null;
          }
          const age = Math.abs(state.millis - e.tick);
          const opacity =
            age > EFFECT_VISUAL_DURATION_MS
              ? 0.0
              : (EFFECT_VISUAL_DURATION_MS - age) / EFFECT_VISUAL_DURATION_MS;
          const rng = new Prando(e.id);
          let text: string;
          let color: string;
          switch (e.tag) {
            case 'DmgDone':
              text = String(Math.abs(e.hp));
              color = crimson;
              break;
            case 'Heal':
              text = String(Math.abs(e.hp));
              color = darkGreen;
              break;
            case 'PickUp':
              text = e.text;
              color = rare;
              break;
            default:
              throw new UnreachableCaseError(e);
          }
          return {
            id: e.id,
            text,
            opacity,
            color,
            offset: new Vector(
              rng.next(-50, 50),
              rng.next(-75, 25) + age * VIS_EFFECT_MOVE_SPEED
            ),

            position: namePos,
          };
        })
        .filter((r) => !!r) as VisLocalEffect[])
    );
  }
  return res;
};

export const KonvaOverlay: React.FC = React.memo(() => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('KonvaOverlay', true);
  const showTractorCircle = useStore((state) => state.showTractorCircle);

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
      {showTractorCircle && <>{tractorDistanceCircle}</>}
      {effects.map((visEffect) => {
        const textWidth = 500;
        return (
          <Text
            key={visEffect.id}
            text={visEffect.text}
            position={visEffect.position}
            fill={visEffect.color}
            align="center"
            opacity={visEffect.opacity}
            offsetY={visEffect.offset.y}
            width={textWidth}
            offsetX={textWidth / 2 + visEffect.offset.x}
          />
        );
      })}
    </Layer>
  );
});
