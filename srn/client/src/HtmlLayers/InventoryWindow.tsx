import React, { useEffect } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';
import { IVector } from '../utils/Vector';

const bounds = {
  left: 5,
  top: 5,
  right: 661 - 55,
  bottom: 661 - 55
}

const cellSize = 60;

const snap = (pos: IVector): IVector => {
  return {
    x: Math.floor(pos.x / cellSize) * cellSize,
    y: pos.y
  }
}

const Item: React.FC<{defaultPosition?:IVector}> = ({defaultPosition}) => {
  return <Draggable bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible' />
  </Draggable>
}

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
      <Item defaultPosition={{x: 5, y: 5}}/>
      <Item defaultPosition={{x: 65, y: 5}}/>
      <Item defaultPosition={{x: 5, y: 65}}/>
    </div>
  </Window>;
};
