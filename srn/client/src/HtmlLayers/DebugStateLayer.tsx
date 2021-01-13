import React from 'react';
import ReactJson from 'react-json-view';
import NetState, { useNSForceChange } from '../NetState';
import { useToggleHotkey } from '../utils/useToggleHotkey';
import { PanelPosition, PanelWithHideButton } from './PanelWithHideButton';

export const DebugStateLayer: React.FC = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;

  useNSForceChange();

  return (
    <PanelWithHideButton
      hotkey="ctrl+shift+d"
      description="show state (huge FPS drop!)"
      defaultValue={false}
      position={PanelPosition.BottomRight}
      extraWide
    >
      <div className="debug-state">
        <ReactJson src={state} />
      </div>
    </PanelWithHideButton>
  );
};
