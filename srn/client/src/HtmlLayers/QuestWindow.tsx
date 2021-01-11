import React from 'react';
import './QuestWindow.scss';
import { StyledRect } from './ui/StyledRect';
export const QuestWindow = () => (
  <div className="quest-window">
    <StyledRect width={300} height={200} line="thick" thickness={10}>
      quest
    </StyledRect>
  </div>
);
