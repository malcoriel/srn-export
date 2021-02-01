import React, { useEffect } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';


export const InventoryWindow = () => {
  return <Window
    height={800}
    width={800}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
  >
    INVENTORY
  </Window>;
};
