import React, { useEffect, useState } from 'react';
import { Window } from './ui/Window';
import { cellsToPixels, ItemGrid, ItemMoveKind, MoveEvent } from './ItemGrid';
import './InventoryWindowBase.scss';
import NetState, { findMyShip, useNSForceChange } from '../NetState';
import { GameState, Market, Player } from '../world';
import { useStore, WindowState } from '../store';

const SCROLL_OFFSET = 10;
const MIN_ROWS = 5;
const COLUMNS = 11;
const WINDOW_MARGIN = 10;

const WINDOW_HEIGHT = cellsToPixels(MIN_ROWS) + WINDOW_MARGIN * 2 + 1;

const WINDOW_WIDTH = cellsToPixels(COLUMNS) + SCROLL_OFFSET + 1;
const EXTRA_ROWS = 3;

const selectWares = (market: Market, planetId: string) => {
  if (!market) {
    return [];
  }
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

  const tradeWindowState = useStore((state) => state.tradeWindow);
  const setTradeWindowState = useStore((state) => state.setTradeWindow);

  useEffect(() => {
    ns.on('gameEvent', (gameEvent: any) => {
      if (gameEvent.TradeTriggerRequest) {
        const event = gameEvent.TradeTriggerRequest;
        const {
          player,
          planet_id,
        }: { player: Player; planet_id: string } = event;
        if (player.id === ns.state.my_id) {
          setPlanetId(planet_id);
          if (tradeWindowState !== WindowState.Shown) {
            setTradeWindowState(WindowState.Shown);
          }
        }
      }
    });
  }, [setTradeWindowState, tradeWindowState, ns]);

  const onMove = (move: MoveEvent) => {
    if (!planetId) return;
    if (move.kind === ItemMoveKind.Sell) {
      ns.sendTradeAction({
        planet_id: planetId,
        sells_to_planet: [[move.item.item_type, move.item.quantity]],
        buys_from_planet: [],
      });
    } else if (move.kind === ItemMoveKind.Buy) {
      ns.sendTradeAction({
        planet_id: planetId,
        sells_to_planet: [],
        buys_from_planet: [[move.item.item_type, move.item.quantity]],
      });
    }
  };

  const onCloseTradeWindow = () => {
    if (planetId) ns.sendDialogueRequest(planetId);
  };

  if (!planetId) return null;

  return (
    <Window
      height={WINDOW_HEIGHT}
      width={WINDOW_WIDTH + SCROLL_OFFSET}
      line="complex"
      storeKey="tradeWindow"
      thickness={8}
      contentClassName="overflow-y-hidden"
      onClose={onCloseTradeWindow}
    >
      <div className="trade-window">
        <div className="trade-window-padded-content">
          <ItemGrid
            items={[
              ...selectPlayerItems(ns.state),
              ...selectWares(ns.state.market, planetId),
            ]}
            injectedGrid={
              <>
                <div
                  className="item-grid grid-green"
                  style={{ width: cellsToPixels(5) }}
                />
                <div
                  className="item-grid grid-red"
                  style={{ width: cellsToPixels(5), left: cellsToPixels(6) }}
                />
              </>
            }
            columnCount={COLUMNS}
            extraRows={EXTRA_ROWS}
            minRows={MIN_ROWS}
            tradeMode={{ columnParams: [5, 1, 5], planetId }}
            onMove={onMove}
          />
        </div>
      </div>
    </Window>
  );
};
