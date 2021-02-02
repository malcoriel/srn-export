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
const COLUMNS = 11;

const WINDOW_WIDTH = height(COLUMNS) + WINDOW_MARGIN * 2;
const CONTENT_HEIGHT = 901;  // 15 rows
const EXTRA_ROWS = 3;

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

const ItemElem: React.FC<{defaultPosition?:IVector, id: string, position?: IVector, onDrag: (e: any, d: any) => void}> = ({id, position, onDrag, defaultPosition}) => {
  return <Draggable position={position} onStop={onDrag} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      {id}
    </div>
  </Draggable>
}

type Item = {
  id: string
}

const positionItems = (items: Item[], width: number) : Record<string, IVector> => {
  let row = 0;
  let column = 0;
  let res:Record<string, IVector> = {};
  for (const item of items) {
    res[item.id] = new Vector(column, row);
    column++;
    if (column >= width) {
      column = 0;
      row++;
    }
  }
  return res;
}

export const ItemGrid: React.FC<{columnCount:number, items: Item[], minRows:number, extraRows: number}> = ({columnCount, items, minRows, extraRows}) => {
  const [positions, setPositions] = useState<Record<string, IVector>>(positionItems(items, columnCount));
  const rowCount = Math.max(((_.max(Object.values(positions).map(p => p.y))|| 0) + 1)  + extraRows , minRows);
  const onDragStop = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: positionToGridPosition(d)
    }))
  }

  return <WithScrollbars noAutoHide>
    <div className="content" style={{height: height(rowCount)}}>
      <div className='grid' />
      {items.map(item => <ItemElem key={item.id} id={item.id} position={gridPositionToPosition(positions[item.id])} onDrag={onDragStop(item.id)} />)}
    </div>
  </WithScrollbars>
}

export const InventoryWindow = () => {
  const items = [{id: "1"}, {id: "2"}, {id: "3"},{id: "4"}, {id: "5"}, {id: "6"}];
  return <Window
    height={WINDOW_HEIGHT}
    width={WINDOW_WIDTH + SCROLL_OFFSET}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
    contentClassName="overflow-y-hidden"
  >
    <div className="inventory-window">
      <ItemGrid items={items} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS}/>
    </div>
  </Window>;
};
