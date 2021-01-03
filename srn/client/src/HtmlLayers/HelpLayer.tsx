import React from 'react';
import { hotkeyRegistry, useToggleHotkey } from '../utils/useToggleHotkey';
import { PanelPosition, PanelWithHideButton } from './PanelWithHideButton';

export const HelpLayer = () => {
  return (
    <PanelWithHideButton
      position={PanelPosition.BottomRight}
      minimized={
        <div className="small-help">
          <div className="line">shift + h for help</div>
        </div>
      }
      defaultValue={true}
      hotkey="shift+h"
      button={true}
    >
      <div className="help">
        <div className="header">Help (shift + h)</div>
        <div className="line">
          movement - WASD or click (try clicking on planets)
        </div>
        <div className="line">dock / undock - space</div>
        <div className="line">mouse wheel - zoom camera</div>
        <div className="line">click/drag on minimap - move camera</div>
        <div className="line">c - reset camera </div>
        <div className="line">dock / undock - space</div>
        {Object.entries(hotkeyRegistry).map(([key, value]) => (
          <div className="line" key={key}>
            <span>{key}</span> - <span>{value}</span>
          </div>
        ))}
      </div>
    </PanelWithHideButton>
  );
};
