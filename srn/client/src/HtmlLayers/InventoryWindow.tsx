import React from 'react';
import { Window } from './ui/Window';
import { cellsToPixels, ItemGrid, ItemMoveKind, MoveEvent } from './ItemGrid';
import styleVars from './InventoryWindow.vars.module.scss';
import './InventoryWindow.scss';
import NetState from '../NetState';
import { InventoryActionBuilder } from '../../../world/pkg/world.extra';
import _ from 'lodash';
import { pxToNumber } from '../utils/pxToNumber';
import { findMyShip } from '../ClientStateIndexing';
import { useNSForceChange } from '../NetStateHooks';

const BOTTOM_BAR_HEIGHT = Number(pxToNumber(styleVars.bottomBarHeight));
const TOP_BAR_HEIGHT = Number(pxToNumber(styleVars.topBarHeight));

const SCROLL_OFFSET = 10;
const MIN_ROWS = 5;
const COLUMNS = 5;
const WINDOW_MARGIN = 10;

const CONTENT_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2 + 1;
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
    } else if (
      moveAction.kind === ItemMoveKind.Merge &&
      moveAction.ontoItemId
    ) {
      ns.sendInventoryAction(
        InventoryActionBuilder.InventoryActionMerge({
          from: moveAction.item.id,
          to: moveAction.ontoItemId,
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
  return (
    <Window
      height={CONTENT_HEIGHT + BOTTOM_BAR_HEIGHT + TOP_BAR_HEIGHT}
      width={WINDOW_WIDTH + SCROLL_OFFSET}
      line="complex"
      storeKey="inventoryWindow"
      thickness={8}
      contentClassName="overflow-y-hidden"
    >
      <div className="inventory-window">
        <div className="inventory-window-padded-content">
          <div className="top-bar">Ship inventory</div>
          <div className="inventory-window-items-content">
            <InventoryWindowItems />
          </div>
          <div className="bottom-bar">Shift+click to split stacks</div>
        </div>
      </div>
    </Window>
  );
};
