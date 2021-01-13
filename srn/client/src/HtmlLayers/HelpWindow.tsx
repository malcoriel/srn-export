import React from 'react';
import { hotkeyRegistry } from '../utils/useToggleHotkey';
import { Window } from './ui/Window';
import './HelpWindow.scss';

export const HelpWindow = () => {
  return (
    <Window
      height={300}
      width={300}
      line="thick"
      thickness={10}
      storeKey="helpWindow"
      className="help-window"
    >
      <div>
        <div className="header">Help (shift + h)</div>
        <div className="line">show menu - ESC </div>
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
    </Window>
  );
};
