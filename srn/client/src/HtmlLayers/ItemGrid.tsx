import React, { useState } from 'react';
import Draggable, { DraggableEventHandler } from 'react-draggable';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';
import _ from 'lodash';
import "./ItemGrid.scss";

const MARGIN = 5;
const CELL_SIZE = 60;
export const cellsToPixels = (cellCount: number) => CELL_SIZE * cellCount + 1; // 1 is last border

export const V_MARGIN = new Vector(MARGIN, MARGIN);

export const gridPositionToPosition = (p?: IVector): IVector => {
  if (!p)
    return snap(VectorFzero);
  return snap(Vector.fromIVector(p)
    .scale(CELL_SIZE)
    .add(V_MARGIN));
};

export const positionToGridPosition = (p: IVector): IVector => {
  return Vector.fromIVector(snap(p))
    .subtract(V_MARGIN)
    .scale(1 / CELL_SIZE);
};

export const snap = (pos: IVector): IVector => {
  return {
    x: Math.round(pos.x / CELL_SIZE) * CELL_SIZE - MARGIN + 0.5,
    y: Math.round(pos.y / CELL_SIZE) * CELL_SIZE + MARGIN + 0.5,
  };
};

export const OnDragEmpty: DraggableEventHandler = (e: any, d: any) => {};

export const ItemElem: React.FC<{ defaultPosition?: IVector, maxY: number, maxX: number, item: Item, position?: IVector, onDragStart?: OnDragItem, onDragStop: (e: any, d: any) => void }> = ({
  item, maxY, onDragStart,
  position, onDragStop, defaultPosition, maxX,
}) => {
  const bounds = {
    left: -MARGIN,
    top: MARGIN + 0.5,
    right: maxX,
    bottom: maxY,
  };

  console.log({ maxY });

  let onStart = onDragStart ? () => {
    onDragStart(item);
  } : OnDragEmpty;
  return <Draggable onStart={onStart} position={position} onStop={onDragStop} bounds={bounds} defaultPosition={defaultPosition}>
    <div className='item-grid-item grabbable-invisible'>
      <div>{item.id}</div>
      <div>{item.quantity}</div>
    </div>
  </Draggable>;
};

export type Item = {
  id: string,
  stackable: boolean,
  playerOwned: boolean,
  quantity: number,
}

export const positionItems = (items: Item[], width: number): Record<string, IVector> => {
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
                                   maxX={contentWidth - CELL_SIZE - 0.5 - MARGIN}
                                   key={item.id} item={item} position={gridPositionToPosition(positions[item.id])}
                                   onDragStop={onDragStop(item.id)} />)}
    </div>
  </WithScrollbars>;
};


