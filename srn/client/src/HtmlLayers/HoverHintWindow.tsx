import React from 'react';
import './HoverHintWindow.scss';
import { useStore } from '../store';
import { findContainer, findMineral } from '../world';
import NetState from '../NetState';
import { useRealToScreen } from '../coordHooks';
import Vector from '../utils/Vector';
import { StyledRect } from './ui/StyledRect';

const WINDOW_OFFSET_PX = new Vector(10, 10);
export const HoverHintWindow: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const hintedObjectId = useStore((state) => state.hintedObjectId);
  const hintedMineral = hintedObjectId
    ? findMineral(ns.state, hintedObjectId)
    : null;

  const hintedContainer = hintedObjectId
    ? findContainer(ns.state, hintedObjectId)
    : null;

  const { realPosToScreenPos, realLenToScreenLen } = useRealToScreen(ns);

  let rendered = null;
  if (hintedMineral || hintedContainer) {
    let position: Vector | null;
    let radius: number | null;
    let windowContent = null;
    if (hintedMineral) {
      const isRare = hintedMineral.value >= 300;
      const isUncommon = hintedMineral.value >= 200;
      //const isCommon = hintedMineral.value >= 100;
      let rarityClass: string;
      if (isRare) {
        rarityClass = 'rare';
      } else {
        rarityClass = isUncommon ? 'uncommon' : 'common';
      }
      position = Vector.fromIVector(hintedMineral);
      radius = hintedMineral.radius;
      windowContent = (
        <>
          <div className="header">Valuable mineral</div>
          <div>
            Rarity: <span className={rarityClass}>{rarityClass}</span>
          </div>
        </>
      );
    } else if (hintedContainer) {
      position = Vector.fromIVector(hintedContainer.position);
      radius = hintedContainer.radius;
      windowContent = (
        <>
          <div className="header">Jettisoned container</div>
          <div>Maybe there&quot;s something valuable inside?</div>
        </>
      );
    } else {
      position = null;
      radius = null;
    }
    if (position && radius) {
      const coord = realPosToScreenPos(position)
        .add(new Vector(1, 1).scale(realLenToScreenLen(radius)))
        .add(WINDOW_OFFSET_PX);
      rendered = (
        <div
          className="hover-hint-window"
          style={{ top: coord.y, left: coord.x }}
        >
          <StyledRect
            width={150}
            height={50}
            line="complex"
            thickness={2}
            contentClassName="content"
          >
            <div className="hover-hint-window-content">{windowContent}</div>
          </StyledRect>
        </div>
      );
    }
  }

  return rendered;
};
