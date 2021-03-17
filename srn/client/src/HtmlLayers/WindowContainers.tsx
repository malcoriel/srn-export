import React from 'react';
import './WindowContainers.scss';

export const WindowContainers: React.FC = () => {
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
