import React, { ReactElement } from 'react';
import Tippy from '@tippyjs/react';
import { followCursor } from 'tippy.js';
import { StyledRect } from './StyledRect';
import './Tooltip.scss';

export const Tooltip: React.ForwardRefExoticComponent<
  React.PropsWithoutRef<{
    readonly children: ReactElement;
    readonly height: number;
    readonly width: number;
  }> &
    React.RefAttributes<unknown>
> = React.forwardRef(({ children, width, height }, forwardRef) => {
  return (
    <Tippy
      content={
        <StyledRect
          width={width}
          height={height}
          contentClassName="ui-tooltip"
          thickness={4}
          line="thin"
        >
          {children}
        </StyledRect>
      }
      followCursor
      plugins={[followCursor]}
      // @ts-ignore
      reference={forwardRef}
    />
  );
});
