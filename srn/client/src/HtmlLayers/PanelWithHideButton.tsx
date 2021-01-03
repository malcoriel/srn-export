import React, { ReactNode } from 'react';
import { useToggleHotkey } from '../utils/useToggleHotkey';

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
}> = ({
  button,
  hotkey,
  defaultValue,
  position,
  description,
  children,
  minimized,
}) => {
  const [shown, setShown] = useToggleHotkey(hotkey, defaultValue, description);
  if (!shown) return <>{minimized}</> || null;
  return (
    <div className={`panel ${posToClassName[position]} close`}>
      {button && (
        <div className="hide-button" onClick={() => setShown(false)}>
          <span className="arrow">←</span>
        </div>
      )}
      {children}
    </div>
  );
};
