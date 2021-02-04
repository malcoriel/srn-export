import { Window } from './ui/Window';
import React from 'react';
import { cellsToPixels, Item, ItemGrid } from './ItemGrid';
import './InventoryWindowBase.scss';

const SCROLL_OFFSET = 10;
let MIN_ROWS = 5;
const COLUMNS = 5;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2;
const WINDOW_WIDTH = cellsToPixels(COLUMNS) + WINDOW_MARGIN * 2;
const EXTRA_ROWS = 3;

const makeTestItem = (id: number, quantity: number, playerOwned: boolean = false): Item => {
  return {
    id: String(id),
    quantity,
    stackable: quantity === 1,
    playerOwned,
  };
};

export const InventoryWindow = () => {
  return <Window
    height={WINDOW_HEIGHT}
    width={WINDOW_WIDTH + SCROLL_OFFSET}
    line='complex'
    storeKey='inventoryWindow'
    thickness={8}
    contentClassName='overflow-y-hidden'
  >
    <div className='inventory-window-base'>
      <div className={`item-grid grid-gray`} style={{ width: cellsToPixels(COLUMNS), height: cellsToPixels(COLUMNS) }} />
      <ItemGrid items={[]} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
    </div>
  </Window>;
};