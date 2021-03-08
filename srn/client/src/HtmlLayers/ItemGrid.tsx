import React, { useState } from 'react';
import { DraggableEventHandler } from 'react-draggable';
import _ from 'lodash';
import Vector, { IVector, VectorFzero } from '../utils/Vector';
import { WithScrollbars } from './ui/WithScrollbars';
import './ItemGrid.scss';
import { InventoryItem } from '../world';
import { ItemElem } from './InventoryItem';

export const ITEM_CELL_MARGIN = 5;
export const ITEM_CELL_SIZE = 60;
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

export const OnDragEmpty: DraggableEventHandler = (_e: any, _d: any) => {};

type ItemGroup = {
  left: number;
  width: number;
};

const splitGroups = (
  tradeMode: [number, number, number]
): [ItemGroup, ItemGroup, ItemGroup] => {
  return [
    {
      left: 0,
      width: tradeMode[0],
    },
    {
      left: tradeMode[0],
      width: tradeMode[1],
    },
    {
      left: tradeMode[0] + tradeMode[1],
      width: tradeMode[2],
    },
  ];
};

function positionItemsInGroup(
  items: InventoryItem[],
  shift: number,
  width1: number
) {
  let row = 0;
  let column = 0;
  const res: Record<string, IVector> = {};
  for (const item of items) {
    res[item.id] = new Vector(shift + column, row);
    column++;
    if (column >= width1) {
      column = 0;
      row++;
    }
  }
  return res;
}

export const positionItems = (
  items: InventoryItem[],
  width: number,
  tradeMode?: [number, number, number]
): Record<string, IVector> => {
  if (tradeMode) {
    const groups = splitGroups(tradeMode);
    return {
      ...positionItemsInGroup(
        items.filter((i) => i.player_owned),
        groups[0].left,
        groups[0].width
      ),
      ...positionItemsInGroup(
        items.filter((i) => !i.player_owned),
        groups[2].left,
        groups[2].width
      ),
    };
  }
  return positionItemsInGroup(items, 0, width);
};

export type OnDragItem = (i: InventoryItem) => void;
export const ItemGrid: React.FC<{
  columnCount: number;
  onDragStart?: OnDragItem;
  items: InventoryItem[];
  minRows: number;
  extraRows: number;
  tradeMode?: [number, number, number];
}> = ({ columnCount, items, tradeMode, minRows, extraRows, onDragStart }) => {
  const [positions, setPositions] = useState<Record<string, IVector>>(
    positionItems(items, columnCount, tradeMode)
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

  const contentHeight = cellsToPixels(rowCount);
  const contentWidth = cellsToPixels(columnCount);
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
