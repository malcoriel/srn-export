import React from 'react';
import './HoverHintWindow.scss';
import { useStore } from '../store';
import { findMineral, unitsToPixels_min } from '../world';
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

  const { realPosToScreenPos, realLenToScreenLen } = useRealToScreen(ns);

  let rendered = null;
  if (hintedMineral) {
    const isRare = hintedMineral.value >= 300;
    const isUncommon = hintedMineral.value >= 200;
    //const isCommon = hintedMineral.value >= 100;
    const rarityClass = isRare ? 'rare' : isUncommon ? 'uncommon' : 'common';

    const coord = realPosToScreenPos(hintedMineral)
      .add(new Vector(1, 1).scale(realLenToScreenLen(hintedMineral.radius)))
      .add(WINDOW_OFFSET_PX);
    rendered = (
      <div
        className="hover-hint-window"
        style={{ top: coord.y, left: coord.x }}
      >
        <StyledRect
          width={150}
          height={47}
          line="complex"
          thickness={2}
          contentClassName="content"
        >
          <div className="header">Valuable mineral</div>
          <div>
            Rarity: <span className={rarityClass}>{rarityClass}</span>
          </div>
        </StyledRect>
      </div>
    );
  }

  return rendered;
};
