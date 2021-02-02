import React, { useEffect, useState } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';
import Vector, { IVector } from '../utils/Vector';

const MARGIN = 5;
const CELL_SIZE = 60;

const bounds = {
  left: MARGIN,
  top: MARGIN,
  right: 661 - (CELL_SIZE - MARGIN),
  bottom: 661 - (CELL_SIZE - MARGIN)
}


const snap = (pos: IVector): IVector => {
  return {
    x: Math.round(pos.x / CELL_SIZE) * CELL_SIZE + MARGIN,
    y: Math.round(pos.y / CELL_SIZE) * CELL_SIZE + MARGIN,
  }
}

const Item: React.FC<{defaultPosition?:IVector, id: string, position?: IVector, onDrag: (e: any, d: any) => void}> = ({id, position, onDrag, defaultPosition}) => {
  return <Draggable position={position} onDrag={onDrag} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      {id}
    </div>
  </Draggable>
}

export const InventoryWindow = () => {
  const [positions, setPositions] = useState<Record<string, IVector>>({
    "1": {x: 5, y: 5},
    "2": {x: 65, y: 5},
    "3": {x: 5, y: 65},
  });
  const onDrag = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: snap(Vector.fromIVector(d))
    }))
  }
  console.log(positions["2"]);
  return <Window
    height={681}
    width={681}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
  >
    <div className="inventory-window">
      <div className="grid"/>
      <Item id="1" position={positions["1"]} onDrag={onDrag("1")} />
      <Item id="2" position={positions["2"]} onDrag={onDrag("2")} />
      <Item id="3" position={positions["3"]} onDrag={onDrag("3")} />

    </div>
  </Window>;
};
