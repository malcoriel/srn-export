import React, { useEffect } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';

export const InventoryWindow = () => {
  return <Window
    height={681}
    width={681}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
  >
    <div className="inventory-window">
      <div className="grid"/>
      <Draggable
    >
      <div className='item grabbable-invisible' />
    </Draggable></div>
  </Window>;
};
