import React from 'react';
import './WindowContainers.scss';

export const WindowContainers: React.FC<{}> = () => {
  return (
    <>
      <div id="shown-windows" className="shown-windows" />
      <div id="minimized-windows" className="minimized-windows" />
    </>
  );
};
