import React, { useState } from 'react';
import { Window } from './ui/Window';
import { cellsToPixels, ItemGrid } from './ItemGrid';
import './InventoryWindowBase.scss';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import { GameState, Market, Player } from '../world';

const SCROLL_OFFSET = 10;
const MIN_ROWS = 11;
const COLUMNS = 11;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2;

const WINDOW_WIDTH = cellsToPixels(COLUMNS) + WINDOW_MARGIN * 2;
const EXTRA_ROWS = 3;

const selectWares = (market: Market, planetId: string) => {
  return (market.wares[planetId] || []).map((it) => ({
    ...it,
    player_owned: false,
  }));
};

const selectPlayerItems = (state: GameState) => {
  const myShip = findMyShip(state);
  if (!myShip) return [];
  return myShip.inventory.map((it) => ({
    ...it,
    player_owned: true,
  }));
};

export const TradeWindow = () => {
  const ns = NetState.get();
  if (!ns) return null;

  const [planetId, setPlanetId] = useState<string | null>(null);
  useNSForceChange('TradeWindow', false, (oldState, newState) => {
    return JSON.stringify(oldState.market) !== JSON.stringify(newState.market);
  });
  ns.on('gameEvent', (gameEvent: any) => {
    if (gameEvent.TradeTriggerRequest) {
      const event = gameEvent.TradeTriggerRequest;
      const {
        player,
        planet_id,
      }: { player: Player; planet_id: string } = event;
      if (player.id === ns.state.my_id) {
        setPlanetId(planet_id);
      }
    }
  });

  if (!planetId) return null;

  return (
    <Window
      height={WINDOW_HEIGHT}
      width={WINDOW_WIDTH + SCROLL_OFFSET}
      line="complex"
      storeKey="tradeWindow"
      thickness={8}
      contentClassName="overflow-y-hidden"
    >
      <div className="inventory-window-base">
        <div
          className="item-grid grid-green"
          style={{ width: cellsToPixels(5) }}
        />
        <div
          className="item-grid grid-red"
          style={{ width: cellsToPixels(5), left: cellsToPixels(6) }}
        />
        <ItemGrid
          items={[
            ...selectPlayerItems(ns.state),
            ...selectWares(ns.state.market, planetId),
          ]}
          columnCount={COLUMNS}
          extraRows={EXTRA_ROWS}
          minRows={MIN_ROWS}
          tradeMode={[5, 1, 5]}
        />
      </div>
    </Window>
  );
};
