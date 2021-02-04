import { Window } from './ui/Window';
import React from 'react';
import { cellsToPixels, Item, ItemGrid } from './ItemGrid';
import './InventoryWindow.scss';

const SCROLL_OFFSET = 10;
let MIN_ROWS = 11;
const COLUMNS = 11;
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

const items = [makeTestItem(1, 1, true), makeTestItem(2, 1, true), makeTestItem(3, 10, true), makeTestItem(4, 5, true)];

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
      <div className={`item-grid grid-green`} style={{ width: cellsToPixels(5) }} />
      <div className={`item-grid grid-red`} style={{ width: cellsToPixels(5), left: cellsToPixels(6) }} />
      <ItemGrid items={items} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
    </div>
  </Window>;
};
