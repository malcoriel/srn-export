import React, { useState } from 'react';
import { DraggableEventHandler } from 'react-draggable';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';
import _ from 'lodash';
import './ItemGrid.scss';
import { InventoryItem } from '../world';
import { ItemElem } from './InventoryItem';

export const ITEM_CELL_MARGIN = 5;
export const ITEM_CELL_SIZE = 60;
export const cellsToPixels = (cellCount: number) =>
  ITEM_CELL_SIZE * cellCount + 1; // 1 is last border

export const V_MARGIN = new Vector(ITEM_CELL_MARGIN, ITEM_CELL_MARGIN);

export const gridPositionToPosition = (p?: IVector): IVector => {
  if (!p) return snap(VectorFzero);
  return snap(Vector.fromIVector(p).scale(ITEM_CELL_SIZE).add(V_MARGIN));
};

export const positionToGridPosition = (p: IVector): IVector => {
  return Vector.fromIVector(snap(p))
    .subtract(V_MARGIN)
    .scale(1 / ITEM_CELL_SIZE);
};

export const snap = (pos: IVector): IVector => {
  return {
    x:
      Math.round(pos.x / ITEM_CELL_SIZE) * ITEM_CELL_SIZE -
      ITEM_CELL_MARGIN +
      0.5,
    y:
      Math.round(pos.y / ITEM_CELL_SIZE) * ITEM_CELL_SIZE +
      ITEM_CELL_MARGIN +
      0.5,
  };
};

export const OnDragEmpty: DraggableEventHandler = (e: any, d: any) => {};

export const positionItems = (
  items: InventoryItem[],
  width: number
): Record<string, IVector> => {
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

export type OnDragItem = (i: InventoryItem) => void;
export const ItemGrid: React.FC<{
  columnCount: number;
  onDragStart?: OnDragItem;
  items: InventoryItem[];
  minRows: number;
  extraRows: number;
}> = ({ columnCount, items, minRows, extraRows, onDragStart }) => {
  const [positions, setPositions] = useState<Record<string, IVector>>(
    positionItems(items, columnCount)
  );
  const rowCount = Math.max(
    (_.max(Object.values(positions).map((p) => p.y)) || 0) + 1 + extraRows,
    minRows
  );
  const onDragStop = (id: string) => (e: any, d: IVector) => {
    setPositions((oldPos) => ({
      ...oldPos,
      [id]: positionToGridPosition(d),
    }));
  };

  let contentHeight = cellsToPixels(rowCount);
  let contentWidth = cellsToPixels(columnCount);
  return (
    <WithScrollbars noAutoHide>
      <div className="content" style={{ height: contentHeight }}>
        {items.map((item) => (
          <ItemElem
            maxY={contentHeight - ITEM_CELL_SIZE + ITEM_CELL_MARGIN}
            onDragStart={onDragStart}
            maxX={contentWidth - ITEM_CELL_SIZE - 0.5 - ITEM_CELL_MARGIN}
            key={item.id}
            item={item}
            position={gridPositionToPosition(positions[item.id])}
            onDragStop={onDragStop(item.id)}
          />
        ))}
      </div>
    </WithScrollbars>
  );
};
