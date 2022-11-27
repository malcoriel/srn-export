import React from 'react';
import ReactJson from 'react-json-view';
import NetState from '../NetState';
import { PanelPosition, PanelWithHideButton } from './PanelWithHideButton';
import { useNSForceChange } from '../NetStateHooks';
import { WithScrollbars } from './ui/WithScrollbars';

const DebugInternals = () => {
  const ns = NetState.get();
  if (!ns) return null;
  const { state } = ns;

  useNSForceChange('DebugStateLayer');
  return (
    <div className="debug-state">
      <WithScrollbars shadowRgbOverride="100, 100, 100">
        <ReactJson src={state} collapsed />
      </WithScrollbars>
    </div>
  );
};

export const DebugStateLayer: React.FC = () => {
  return (
    <PanelWithHideButton
      hotkey="shift+d"
      description="show state (huge FPS drop!)"
      defaultValue={false}
      position={PanelPosition.BottomRight}
      extraWide
    >
      <DebugInternals />
    </PanelWithHideButton>
  );
};
