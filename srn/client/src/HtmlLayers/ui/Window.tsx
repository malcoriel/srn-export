import React from 'react';
import _ from 'lodash';
import { useStore, WindowState } from '../../store';
import { Button } from './Button';
import { AiFillCaretDown, AiFillCaretUp, CgClose } from 'react-icons/all';
import { StyledRect } from './StyledRect';
import ReactDOM from 'react-dom';
import './Window.scss';
import { useHotkeys } from 'react-hotkeys-hook';

export const Window: React.FC<{
  storeKey: string;
  fixedState?: WindowState;
  minimized?: React.ReactNode;
  width: number;
  height: number;
  thickness: number;
  line: 'complex' | 'thick' | 'thin';
  halfThick?: boolean;
  unclosable?: boolean;
  highPriority?: boolean;
  contentClassName?: string;
  className?: string;
  minimizedClassname?: string;
  onClose?: () => void;
}> = ({
  onClose,
  storeKey,
  children,
  width,
  height,
  thickness,
  line,
  minimized,
  className,
  fixedState,
  unclosable,
  contentClassName,
  minimizedClassname,
  highPriority,
}) => {
  const key = storeKey;
  const setKey = `set${_.upperFirst(key)}`;
  const storeParts = useStore((state) => ({
    [key]: (state as Record<string, any>)[key],
    [setKey]: (state as Record<string, any>)[setKey],
  }));
  const state = fixedState || (storeParts[key] as WindowState);
  const minimize = () => storeParts[setKey](WindowState.Minimized);
  const maximize = () => storeParts[setKey](WindowState.Shown);
  const hide = () => {
    if (onClose) onClose();

    return storeParts[setKey](
      unclosable ? WindowState.Minimized : WindowState.Hidden
    );
  };
  const isShown = state === WindowState.Shown;
  const isMinimized = state === WindowState.Minimized;

  const windowButtons = (
    <div
      className="ui-window-controls"
      style={{ height: isShown ? thickness + 2 : undefined }}
    >
      {!isMinimized && minimized ? (
        <Button onClick={minimize}>
          <AiFillCaretDown />
        </Button>
      ) : null}
      {isMinimized && (
        <Button onClick={maximize}>
          <AiFillCaretUp />
        </Button>
      )}
      {!unclosable && (
        <Button onClick={hide}>
          <CgClose />
        </Button>
      )}
    </div>
  );
  const minimizedMountPoint = document.getElementById('minimized-windows');
  const shownWindowsMountPoint = !highPriority
    ? document.getElementById('shown-windows')
    : document.getElementById('high-priority-windows');
  if (!minimizedMountPoint || !shownWindowsMountPoint) return null;
  return (
    <>
      {!isMinimized &&
        isShown &&
        ReactDOM.createPortal(
          <div className={`ui-window ${className}`}>
            <div className="ui-window-shown ">
              <StyledRect
                width={width}
                height={height}
                line={line}
                thickness={thickness}
                contentClassName={`ui-window-content ${
                  contentClassName || ''
                } css-content-window-${key}`}
              >
                {windowButtons}
                {children}
              </StyledRect>
            </div>
          </div>,
          shownWindowsMountPoint
        )}
      {isMinimized &&
        ReactDOM.createPortal(
          <div className={`ui-window-minimized ${minimizedClassname}`}>
            {minimized}
            {windowButtons}
          </div>,
          minimizedMountPoint
        )}
    </>
  );
};
