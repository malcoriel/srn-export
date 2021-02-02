import React, { useState } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';
import Vector, { IVector } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';
import _ from 'lodash';

const MARGIN = 5;
const CELL_SIZE = 60;
const SCROLL_OFFSET = 10;
const WINDOW_MARGIN = 10;
const height = (rowCount: number) => CELL_SIZE * rowCount + 1; // 1 is last border
let MIN_ROWS = 11;
const WINDOW_HEIGHT = height(MIN_ROWS) + WINDOW_MARGIN * 2;
const CONTENT_HEIGHT = 901;  // 15 rows

const bounds = {
  left: MARGIN - SCROLL_OFFSET,
  top: MARGIN - SCROLL_OFFSET,
  right: 661 - (CELL_SIZE - MARGIN) - SCROLL_OFFSET,
  bottom: CONTENT_HEIGHT - (CELL_SIZE - MARGIN) + SCROLL_OFFSET
}

const V_MARGIN = new Vector(MARGIN, MARGIN);

const gridPositionToPosition = (p: IVector): IVector => {
  return snap(Vector.fromIVector(p).scale(CELL_SIZE).add(V_MARGIN));
}

const positionToGridPosition = (p: IVector): IVector => {
  return Vector.fromIVector(snap(p)).subtract(V_MARGIN).scale(1/ CELL_SIZE);
}

const snap = (pos: IVector): IVector => {
  return {
    x: Math.round(pos.x / CELL_SIZE) * CELL_SIZE + MARGIN - SCROLL_OFFSET + 0.5,
    y: Math.round(pos.y / CELL_SIZE) * CELL_SIZE + MARGIN + 0.5,
  }
}

const Item: React.FC<{defaultPosition?:IVector, id: string, position?: IVector, onDrag: (e: any, d: any) => void}> = ({id, position, onDrag, defaultPosition}) => {
  return <Draggable position={position} onStop={onDrag} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      {id}
    </div>
  </Draggable>
}

const EXTRA_ROWS = 3;
export const InventoryWindow = () => {
  const [positions, setPositions] = useState<Record<string, IVector>>({
    "1": {x: 0, y: 0},
    "2": {x: 1, y: 0},
    "3": {x: 0, y: 1},
  });
  const rowCount = Math.max(((_.max(Object.values(positions).map(p => p.y))|| 0) + 1)  + EXTRA_ROWS , MIN_ROWS);
  const onDrag = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: positionToGridPosition(d)
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
        <div className="content" style={{height: height(rowCount)}}>
          <div className='grid' />
          <Item id='1' position={gridPositionToPosition(positions['1'])} onDrag={onDrag('1')} />
          <Item id='2' position={gridPositionToPosition(positions['2'])} onDrag={onDrag('2')} />
          <Item id='3' position={gridPositionToPosition(positions['3'])} onDrag={onDrag('3')} />
        </div>
      </WithScrollbars>

    </div>
  </Window>;
};
