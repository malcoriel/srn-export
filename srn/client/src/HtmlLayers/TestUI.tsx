import React from 'react';
import './TestUI.scss';
import { StyledRect } from './ui/StyledRect';

export const TestUI = () => (
  <div className="test-ui">
    <StyledRect
      line="thin"
      halfThick
      width={238}
      height={800}
      thickness={8}
      noLeft
      noBottom
    >
      My text
    </StyledRect>
  </div>
);
