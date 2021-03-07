import React from 'react';
import ReactJson from 'react-json-view';
import NetState, { useNSForceChange } from '../NetState';
import { PanelPosition, PanelWithHideButton } from './PanelWithHideButton';

const DebugInternals = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;

  useNSForceChange('DebugStateLayer');
  return (
    <div className="debug-state">
      <ReactJson src={state} />
    </div>
  );
};

export const DebugStateLayer: React.FC = () => {
  return (
    <PanelWithHideButton
      hotkey="ctrl+shift+d"
      description="show state (huge FPS drop!)"
      defaultValue={false}
      position={PanelPosition.BottomRight}
      extraWide
    >
      <DebugInternals />
    </PanelWithHideButton>
  );
};
