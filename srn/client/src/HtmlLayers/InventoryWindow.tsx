import React, { useEffect, useState } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';
import Vector, { IVector } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';

const MARGIN = 5;
const CELL_SIZE = 60;
const SCROLL_OFFSET = 10;
const WINDOW_MARGIN = 10;
const WINDOW_HEIGHT = 681;
const CONTENT_HEIGHT = 881;

const MAX_Y = CONTENT_HEIGHT;

const bounds = {
  left: MARGIN - SCROLL_OFFSET,
  top: MARGIN - SCROLL_OFFSET,
  right: 661 - (CELL_SIZE - MARGIN) - SCROLL_OFFSET,
  bottom: MAX_Y - (CELL_SIZE - MARGIN) + SCROLL_OFFSET
}


const snap = (pos: IVector): IVector => {
  return {
    x: Math.round(pos.x / CELL_SIZE) * CELL_SIZE + MARGIN - SCROLL_OFFSET,
    y: Math.round(pos.y / CELL_SIZE) * CELL_SIZE + MARGIN - SCROLL_OFFSET,
  }
}

const Item: React.FC<{defaultPosition?:IVector, id: string, position?: IVector, onDrag: (e: any, d: any) => void}> = ({id, position, onDrag, defaultPosition}) => {
  return <Draggable position={position} onStop={onDrag} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      {id}
    </div>
  </Draggable>
}

export const InventoryWindow = () => {
  const [positions, setPositions] = useState<Record<string, IVector>>({
    "1": snap({x: 5, y: 5}),
    "2": snap({x: 65, y: 5}),
    "3": snap({x: 5, y: 65}),
  });
  const onDrag = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: snap(Vector.fromIVector(d))
    }))
  }
  return <Window
    height={WINDOW_HEIGHT}
    width={681 + SCROLL_OFFSET}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
    contentClassName="overflow-y-hidden"
  >
    <div className="inventory-window">
      <WithScrollbars noAutoHide>
        <div className="content">
          <div className='grid' />
          <Item id='1' position={positions['1']} onDrag={onDrag('1')} />
          <Item id='2' position={positions['2']} onDrag={onDrag('2')} />
          <Item id='3' position={positions['3']} onDrag={onDrag('3')} />
        </div>
      </WithScrollbars>

    </div>
  </Window>;
};
