import React from 'react';
import './WindowContainers.scss';
import { useScopedHotkey } from '../utils/hotkeyHooks';
import { useStore } from '../store';

export const WindowContainers: React.FC = () => {
  const hideAllWindows = useStore((store) => store.hideAllWindows);
  useScopedHotkey(
    'esc',
    () => {
      hideAllWindows();
    },
    'window',
    {},
    []
  );
  return (
    <>
      <div id="high-priority-windows" className="high-priority-windows">
        <div className="backdrop" />
      </div>
      <div id="shown-windows" className="shown-windows">
        <div className="backdrop" />
      </div>
      <div id="minimized-windows" className="minimized-windows" />
    </>
  );
};
