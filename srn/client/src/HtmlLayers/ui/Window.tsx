import React from 'react';
import _ from 'lodash';
import { useStore, WindowState } from '../../store';
import { Button } from './Button';
import { AiFillCaretDown, AiFillCaretUp, CgClose } from 'react-icons/all';
import { StyledRect } from './StyledRect';
import ReactDOM from 'react-dom';
import './Window.scss';
export const Window: React.FC<{
  storeKey: string;
  minimized?: React.ReactNode;
  width: number;
  height: number;
  thickness: number;
  line: 'complex' | 'thick' | 'thin';
  halfThick?: boolean;
  contentClassName?: string;
  className?: string;
}> = ({
  storeKey,
  children,
  width,
  height,
  thickness,
  line,
  minimized,
  className,
  contentClassName,
}) => {
  const key = storeKey;
  const setKey = `set${_.upperFirst(key)}`;
  const storeParts = useStore((state) => ({
    [key]: (state as Record<string, any>)[key],
    [setKey]: (state as Record<string, any>)[setKey],
  }));
  const state = storeParts[key] as WindowState;
  const minimize = () => storeParts[setKey](WindowState.Minimized);
  const maximize = () => storeParts[setKey](WindowState.Shown);
  const hide = () => storeParts[setKey](WindowState.Hidden);

  const isShown = state === WindowState.Shown;
  const isMinimized = state === WindowState.Minimized;

  const windowButtons = (
    <div
      className="ui-window-controls"
      style={{ height: isShown ? thickness : undefined }}
    >
      {!isMinimized && (
        <Button onClick={minimize}>
          <AiFillCaretDown />
        </Button>
      )}
      {isMinimized && (
        <Button onClick={maximize}>
          <AiFillCaretUp />
        </Button>
      )}
      <Button onClick={hide}>
        <CgClose />
      </Button>
    </div>
  );
  return (
    <div className="ui-window">
      {isShown && (
        <div className={`ui-window-shown ${className}`}>
          <StyledRect
            width={width}
            height={height}
            line={line}
            thickness={thickness}
            contentClassName={contentClassName}
          >
            {windowButtons}
            {children}
          </StyledRect>
        </div>
      )}

      {isMinimized &&
        ReactDOM.createPortal(
          <div className="ui-window-minimized">
            {minimized}
            {windowButtons}
          </div>,
          document.getElementById('minimized-windows')!
        )}
    </div>
  );
};