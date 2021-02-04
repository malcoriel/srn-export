import React, { DragEventHandler, useState } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable, { DraggableEventHandler } from 'react-draggable';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';
import _ from 'lodash';

const MARGIN = 5;
const CELL_SIZE = 60;
const SCROLL_OFFSET = 10;
const WINDOW_MARGIN = 10;
const cellsToPixels = (rowCount: number) => CELL_SIZE * rowCount + 1; // 1 is last border
let MIN_ROWS = 11;
const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2;
const COLUMNS = 11;

const WINDOW_WIDTH = cellsToPixels(COLUMNS) + WINDOW_MARGIN * 2;
const EXTRA_ROWS = 3;


const V_MARGIN = new Vector(MARGIN, MARGIN);

const gridPositionToPosition = (p?: IVector): IVector => {
  if (!p)
    return snap(VectorFzero);
  return snap(Vector.fromIVector(p)
    .scale(CELL_SIZE)
    .add(V_MARGIN));
};

const positionToGridPosition = (p: IVector): IVector => {
  return Vector.fromIVector(snap(p))
    .subtract(V_MARGIN)
    .scale(1 / CELL_SIZE);
};

const snap = (pos: IVector): IVector => {
  return {
    x: Math.round(pos.x / CELL_SIZE) * CELL_SIZE + MARGIN - SCROLL_OFFSET + 0.5,
    y: Math.round(pos.y / CELL_SIZE) * CELL_SIZE + MARGIN + 0.5,
  };
};

const OnDragEmpty: DraggableEventHandler = (e: any, d: any) => {};

const ItemElem: React.FC<{ defaultPosition?: IVector, maxY: number, maxX: number, item: Item, position?: IVector, onDragStart?: OnDragItem, onDragStop: (e: any, d: any) => void }> = ({
  item, maxY, onDragStart,
  position, onDragStop, defaultPosition, maxX,
}) => {
  const bounds = {
    left: MARGIN - SCROLL_OFFSET,
    top: MARGIN + 0.5,
    right: maxX,
    bottom: maxY,
  };

  console.log({ maxY });

  let onStart = onDragStart ? () => {
    onDragStart(item);
  } : OnDragEmpty;
  return <Draggable onStart={onStart} position={position} onStop={onDragStop} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      <div>{item.id}</div>
      <div>{item.quantity}</div>
    </div>
  </Draggable>;
};

type Item = {
  id: string,
  stackable: boolean,
  playerOwned: boolean,
  quantity: number,
}

const positionItems = (items: Item[], width: number): Record<string, IVector> => {
  let row = 0;
  let column = 0;
  let res: Record<string, IVector> = {};
  for (const item of items) {
    res[item.id] = new Vector(column, row);
    column++;
    if (column >= width) {
      column = 0;
      row++;
    }
  }
  return res;
};

type OnDragItem = (i: Item) => void;
export const ItemGrid: React.FC<{ columnCount: number, onDragStart?:
    OnDragItem, items: Item[], minRows: number, extraRows: number }> = ({
  columnCount,
  items,
  minRows,
  extraRows,
  onDragStart
}) => {
  const [positions, setPositions] = useState<Record<string, IVector>>(positionItems(items, columnCount));
  const rowCount = Math.max(((_.max(Object.values(positions)
    .map(p => p.y)) || 0) + 1) + extraRows, minRows);
  const onDragStop = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: positionToGridPosition(d),
    }));
  };


  let contentHeight = cellsToPixels(rowCount);
  let contentWidth = cellsToPixels(columnCount);
  return <WithScrollbars noAutoHide>
    <div className='content' style={{ height: contentHeight }}>
      {items.map(item => <ItemElem maxY={contentHeight - CELL_SIZE + MARGIN}
                                   onDragStart={onDragStart}
                                   maxX={contentWidth - CELL_SIZE - 0.5 - SCROLL_OFFSET + MARGIN}
                                   key={item.id} item={item} position={gridPositionToPosition(positions[item.id])}
                                   onDragStop={onDragStop(item.id)} />)}
    </div>
  </WithScrollbars>;
};

const makeTestItem = (id: number, quantity: number, playerOwned: boolean = false): Item => {
  return {
    id: String(id),
    quantity,
    stackable: quantity === 1,
    playerOwned,
  };
};

const items =[makeTestItem(1, 1, true), makeTestItem(2, 1, true), makeTestItem(3, 10, true), makeTestItem(4, 5, true)];

export const InventoryWindow = () => {
  return <Window
    height={WINDOW_HEIGHT}
    width={WINDOW_WIDTH + SCROLL_OFFSET}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
    contentClassName='overflow-y-hidden'
  >
    <div className='inventory-window'>
      <div className='moving-grid'>
        <div className={`grid grid-green`} style={{width: cellsToPixels(5)}}/>
        <div className={`grid grid-red`} style={{width: cellsToPixels(5), left: cellsToPixels(6)}} />
        <ItemGrid items={items} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
      </div>
    </div>
  </Window>;
};
