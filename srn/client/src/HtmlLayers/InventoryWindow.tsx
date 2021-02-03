import React, { useState } from 'react';
import './InventoryWindow.scss';
import { Window } from './ui/Window';
import Draggable from 'react-draggable';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
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

const ItemElem: React.FC<{ defaultPosition?: IVector, maxY: number, maxX: number, item: Item, position?: IVector, onDrag: (e: any, d: any) => void }> = ({
  item, maxY,
  position, onDrag, defaultPosition, maxX,
}) => {
  const bounds = {
    left: MARGIN - SCROLL_OFFSET,
    top: MARGIN + 0.5,
    right: maxX,
    bottom: maxY,
  };

  console.log({ maxY });

  return <Draggable position={position} onStop={onDrag} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item grabbable-invisible'>
      <div>{item.id}</div>
      <div>{item.quantity}</div>
    </div>
  </Draggable>;
};

type Item = {
  id: string,
  stackable: boolean,
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

export const ItemGrid: React.FC<{ columnCount: number, items: Item[], minRows: number, extraRows: number, red?: boolean, green?: boolean }> = ({
  red,
  green,
  columnCount,
  items,
  minRows,
  extraRows,
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

  const color = red ? 'grid-red' : (green ? 'grid-green' : 'grid-gray');

  let contentHeight = height(rowCount);
  let contentWidth = height(columnCount);
  return <WithScrollbars noAutoHide>
    <div className='content' style={{ height: contentHeight }}>
      <div className={`grid ${color}`} />
      {items.map(item => <ItemElem maxY={contentHeight - CELL_SIZE + MARGIN} maxX={contentWidth - CELL_SIZE - 0.5 - SCROLL_OFFSET + MARGIN}
                                   key={item.id} item={item} position={gridPositionToPosition(positions[item.id])}
                                   onDrag={onDragStop(item.id)} />)}
    </div>
  </WithScrollbars>;
};

const makeTestItem = (id: number, quantity: number): Item => {
  return {
    id: String(id),
    quantity,
    stackable: quantity === 1,
  };
};

export const InventoryWindow = () => {
  const itemsGreen = [makeTestItem(1, 1), makeTestItem(2, 1), makeTestItem(3, 10), makeTestItem(4, 5)];
  const itemsRed = [makeTestItem(5, 2), makeTestItem(6, 12)];
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
        <ItemGrid items={[]} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
      </div>
      <div className='left-grid'>
        <ItemGrid green items={itemsGreen} columnCount={5} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
      </div>
      <div className='right-grid'>
        <ItemGrid red items={itemsRed} columnCount={5} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
      </div>
    </div>
  </Window>;
};
