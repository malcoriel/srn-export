import React, { ReactNode } from 'react';
import './HoverHintWindow.scss';
import { StyledRect } from './ui/StyledRect';
import { NatSpawnMineral } from '../../../world/pkg';
import { Rarity } from '../../../world/pkg/world.extra';

export const mineralHintContent = (hintedMineral: NatSpawnMineral) => {
  const isRare = hintedMineral.rarity === Rarity.Rare;
  const isUncommon = hintedMineral.rarity === Rarity.Uncommon;
  //const isCommon = hintedMineral.value >= 100;
  let rarityClass: string;
  if (isRare) {
    rarityClass = 'rare';
  } else {
    rarityClass = isUncommon ? 'uncommon' : 'common';
  }
  return (
    <>
      <div className="header">Valuable mineral</div>
      <div>
        Rarity: <span className={rarityClass}>{rarityClass}</span>
      </div>
    </>
  );
};

export const containerHintContent = () => {
  return (
    <>
      <div className="header">Jettisoned container</div>
      <div>Maybe there&quot;s something valuable inside?</div>
    </>
  );
};

export const HintWindow: React.FC<{
  windowContent: ReactNode;
}> = ({ windowContent }) => {
  return (
    <div className="hover-hint-window">
      <StyledRect
        width={150}
        autoHeight
        line="complex"
        thickness={2}
        contentClassName="content"
      >
        <div className="hover-hint-window-content">{windowContent}</div>
      </StyledRect>
    </div>
  );
};
