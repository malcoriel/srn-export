import React from 'react';
import { Window } from './ui/Window';
import { cellsToPixels, ItemGrid, ItemMoveKind, MoveEvent } from './ItemGrid';
import './InventoryWindowBase.scss';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import { InventoryActionBuilder } from '../../../world/pkg/builders';
import _ from 'lodash';

const SCROLL_OFFSET = 10;
const MIN_ROWS = 5;
const COLUMNS = 5;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2 + 1;
const WINDOW_WIDTH = cellsToPixels(COLUMNS) + SCROLL_OFFSET;
const EXTRA_ROWS = 3;

const InventoryWindowItems = () => {
  const ns = NetState.get();
  if (!ns) return null;

  useNSForceChange('inventory window', false, (prevState, nextState) => {
    const myShipPrev = findMyShip(prevState) || { inventory: [] };
    const myShipNext = findMyShip(nextState) || { inventory: [] };
    return (
      JSON.stringify(myShipPrev.inventory) !==
      JSON.stringify(myShipNext.inventory)
    );
  });

  const onMove = (moveAction: MoveEvent) => {
    if (moveAction.kind === ItemMoveKind.OwnMove) {
      ns.sendInventoryAction(
        InventoryActionBuilder.InventoryActionMove({
          item: moveAction.item.id,
          index: moveAction.newIndex,
        })
      );
    }
  };

  const onSplit = (itemId: string, count: number) => {
    if (_.isNaN(count) || count <= 0) {
      console.warn(`Bad split count ${count}`);
      return;
    }
    ns.sendInventoryAction(
      InventoryActionBuilder.InventoryActionSplit({
        from: itemId,
        count,
      })
    );
  };

  const myShip = findMyShip(ns.state);
  if (!myShip) return null;
  const inventory = myShip.inventory;
  return (
    <ItemGrid
      onSplit={onSplit}
      onMove={onMove}
      items={inventory}
      columnCount={COLUMNS}
      extraRows={EXTRA_ROWS}
      minRows={MIN_ROWS}
    />
  );
};

export const InventoryWindow = () => {
  const height = WINDOW_HEIGHT;
  const width = WINDOW_WIDTH + SCROLL_OFFSET;

  return (
    <Window
      height={height}
      width={width}
      line="complex"
      storeKey="inventoryWindow"
      thickness={8}
      contentClassName="overflow-y-hidden"
    >
      <div className="inventory-window">
        <div className="inventory-window-padded-content">
          <InventoryWindowItems />
        </div>
      </div>
    </Window>
  );
};
