import { Window } from './ui/Window';
import React from 'react';
import { cellsToPixels, ItemGrid } from './ItemGrid';
import './InventoryWindowBase.scss';

const SCROLL_OFFSET = 10;
let MIN_ROWS = 11;
const COLUMNS = 11;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2;

const WINDOW_WIDTH = cellsToPixels(COLUMNS) + WINDOW_MARGIN * 2;
const EXTRA_ROWS = 3;

export const TradeWindow = () => {
  return <Window
    height={WINDOW_HEIGHT}
    width={WINDOW_WIDTH + SCROLL_OFFSET}
    line='complex'
    storeKey='tradeWindow'
    thickness={8}
    contentClassName='overflow-y-hidden'
  >
    <div className='inventory-window-base'>
      <div className={`item-grid grid-green`} style={{ width: cellsToPixels(5) }} />
      <div className={`item-grid grid-red`} style={{ width: cellsToPixels(5), left: cellsToPixels(6) }} />
      <ItemGrid items={[]} columnCount={COLUMNS} extraRows={EXTRA_ROWS} minRows={MIN_ROWS} />
    </div>
  </Window>;
};
