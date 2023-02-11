import React, { useRef } from 'react';
import Draggable from 'react-draggable';
import { IVector } from '../utils/Vector';
import { InventoryItem, InventoryItemType, Price } from '../world';
import { ITEM_CELL_MARGIN, OnDragEmpty } from './ItemGrid';
import { common, gray, rare, uncommon } from '../utils/palette';

import BoxPng from '../../public/resources/box.png';
import { Tooltip } from './ui/Tooltip';
import { UnreachableCaseError } from 'ts-essentials';
import NetState from '../NetState';
import { OreSvg } from './svg/OreSvg';
import { FoodSvg } from './svg/FoodSvg';
import MedicineSvg from './svg/MedicineSvg';
import { WeaponSvg } from './svg/WeaponSvg';

const getDisplayName = (iit: InventoryItemType): string => {
  switch (iit) {
    case InventoryItemType.Food:
      return 'Food';
    case InventoryItemType.Medicament:
      return 'Medicament';
    case InventoryItemType.HandWeapon:
      return 'Hand weapon';
    case InventoryItemType.Unknown:
      return 'Unknown item';
    case InventoryItemType.CommonMineral:
      return 'Common mineral';
    case InventoryItemType.UncommonMineral:
      return 'Uncommon mineral';
    case InventoryItemType.RareMineral:
      return 'Rare mineral';
    case InventoryItemType.QuestCargo:
      return 'Quest cargo';
    default:
      throw new UnreachableCaseError(iit);
  }
};

const getItemColor = (iit: InventoryItemType): string => {
  switch (iit) {
    case InventoryItemType.Food:
      return common;
    case InventoryItemType.Medicament:
      return uncommon;
    case InventoryItemType.HandWeapon:
      return rare;
    case InventoryItemType.Unknown:
      return gray;
    case InventoryItemType.CommonMineral:
      return common;
    case InventoryItemType.UncommonMineral:
      return uncommon;
    case InventoryItemType.RareMineral:
      return rare;
    case InventoryItemType.QuestCargo:
      return rare;
    default:
      throw new UnreachableCaseError(iit);
  }
};

const renderItem = (item: InventoryItem) => {
  switch (item.item_type) {
    case InventoryItemType.Unknown:
      return null;
    case InventoryItemType.CommonMineral:
      return (
        <OreSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    case InventoryItemType.UncommonMineral:
      return (
        <OreSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    case InventoryItemType.RareMineral:
      return (
        <OreSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    case InventoryItemType.QuestCargo:
      return (
        <div style={{ width: 50, height: 50, margin: 5 }}>
          <img draggable={false} src={BoxPng} width={40} height={40} alt="" />
        </div>
      );
    case InventoryItemType.Food:
      return (
        <FoodSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    case InventoryItemType.Medicament:
      return (
        <MedicineSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    case InventoryItemType.HandWeapon:
      return (
        <WeaponSvg
          width={50}
          height={50}
          fill={getItemColor(item.item_type)}
          stroke="#111"
        />
      );
    default:
      throw new UnreachableCaseError(item.item_type);
  }
};

export const ItemElem: React.FC<{
  defaultPosition?: IVector;
  maxY: number;
  maxX: number;
  tradeModePlanet?: string;
  item: InventoryItem;
  position?: IVector;
  onDragStop: (e: any, d: any) => void;
  onClick?: (item: InventoryItem) => void;
  onDragStart: (e: any, d: any, item: InventoryItem) => void;
}> = ({
  item,
  maxY,
  onClick,
  onDragStart,
  position,
  onDragStop,
  defaultPosition,
  maxX,
  tradeModePlanet,
}) => {
  const ns = NetState.get();
  if (!ns) return null;
  const bounds = {
    left: -ITEM_CELL_MARGIN,
    top: ITEM_CELL_MARGIN + 0.5,
    right: maxX,
    bottom: maxY,
  };

  const itemRef = useRef(null);
  let price: Price | undefined;
  if (tradeModePlanet) {
    if (ns.state.market) {
      const planetPrices = ns.state.market.prices[tradeModePlanet];
      if (planetPrices) {
        price = planetPrices[item.item_type];
      }
    }
  }

  return (
    <>
      <Draggable
        onStart={((e: any, d: any) => onDragStart(e, d, item)) || OnDragEmpty}
        position={position}
        onStop={onDragStop}
        bounds={bounds}
        defaultPosition={defaultPosition}
      >
        <div
          onClick={onClick ? () => onClick(item) : () => {}}
          className="item-grid-item grabbable-invisible"
          ref={itemRef}
        >
          {renderItem(item)}
          {item.quantity !== 1 && (
            <div className="quantity">{item.quantity}</div>
          )}
        </div>
      </Draggable>
      <Tooltip ref={itemRef} width={150} height={price ? 76 : 46}>
        <>
          <div>{getDisplayName(item.item_type)}</div>
          <div>Base value: {item.value}</div>
          {price ? (
            <>
              {/* Sell and buy are planet's */}
              <div>Buy here: {price.sell}</div>
              <div>Sell here: {price.buy}</div>
            </>
          ) : null}
        </>
      </Tooltip>
    </>
  );
};
