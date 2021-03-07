import React, { ReactNode } from 'react';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { useLocalStorage } from '../utils/useLocalStorage';

export enum PanelPosition {
  Unknown,
  Center,
  TopLeft,
  TopRight,
  BottomRight,
  BottomLeft,
}

const posToClassName = {
  [PanelPosition.BottomRight]: 'aux-panel',
  [PanelPosition.BottomLeft]: 'game-panel',
};

export const PanelWithHideButton: React.FC<{
  hotkey: string;
  defaultValue: boolean;
  description?: string;
  children: ReactNode;
  position: PanelPosition.BottomRight | PanelPosition.BottomLeft;
  minimized?: ReactNode;
  button?: boolean;
  extraWide?: boolean;
}> = ({
  button = true,
  hotkey,
  defaultValue,
  position,
  description,
  children,
  minimized,
  extraWide,
}) => {
  const [lsShow, setLsShow] = useLocalStorage(`show-${hotkey}`, defaultValue);
  const [shown, setShown] = useToggleHotkey(
    hotkey,
    lsShow,
    description,
    (val) => {
      setLsShow(val);
    }
  );
  if (!shown)
    return (
    (
      <div className="panel-minimized" onClick={() => setShown(true)}>
        {minimized}
      </div>
    ) || null
  );
  return (
    <div
      className={`panel ${posToClassName[position]} close ${
        extraWide ? 'extra-wide' : ''
      }`}
    >
      {button && (
        <div
          className="hide-button"
          onClick={() => {
            setLsShow(false);
            setShown(false);
          }}
        >
          <span className="arrow"> ➔ </span>
        </div>
      )}
      {children}
    </div>
  );
};
