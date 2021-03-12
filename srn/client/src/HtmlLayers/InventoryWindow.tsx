import React from 'react';
import { Window } from './ui/Window';
import { cellsToPixels, ItemGrid } from './ItemGrid';
import './InventoryWindowBase.scss';
import NetState, { findMyShip, useNSForceChange } from '../NetState';

const SCROLL_OFFSET = 10;
const MIN_ROWS = 5;
const COLUMNS = 5;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS);
const WINDOW_WIDTH = cellsToPixels(COLUMNS) + SCROLL_OFFSET;
const EXTRA_ROWS = 3;

const InventoryWindowItems = () => {
  useNSForceChange('inventory window', false, (prevState, nextState) => {
    const myShipPrev = findMyShip(prevState) || { inventory: [] };
    const myShipNext = findMyShip(nextState) || { inventory: [] };
    return (
      JSON.stringify(myShipPrev.inventory) !==
      JSON.stringify(myShipNext.inventory)
    );
  });

  const ns = NetState.get();
  if (!ns) return null;
  const myShip = findMyShip(ns.state);
  if (!myShip) return null;
  const inventory = myShip.inventory;
  return (
    <ItemGrid
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
  console.log({ width, height });

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
        <InventoryWindowItems />
      </div>
    </Window>
  );
};
