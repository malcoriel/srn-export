import React from 'react';
import { IVector } from '../utils/Vector';
import { InventoryItem, InventoryItemType } from '../world';
import Draggable from 'react-draggable';
import { ITEM_CELL_MARGIN, OnDragEmpty, OnDragItem } from './ItemGrid';
import { common, gray, rare, uncommon } from '../utils/palette';
import MineralSvg from './ui/MineralSvg';
const itemTypeToColor = {
  [InventoryItemType.Unknown]: gray,
  [InventoryItemType.CommonMineral]: common,
  [InventoryItemType.UncommonMineral]: uncommon,
  [InventoryItemType.RareMineral]: rare,
};

const defaultColor = gray;

const getColor = (iit: InventoryItemType) : string =>  {
  console.log(iit);
  return itemTypeToColor[iit] || defaultColor;
}

export const ItemElem: React.FC<{ defaultPosition?: IVector, maxY: number, maxX: number, item: InventoryItem, position?: IVector, onDragStart?: OnDragItem, onDragStop: (e: any, d: any) => void }> = ({
  item, maxY, onDragStart,
  position, onDragStop, defaultPosition, maxX,
}) => {
  const bounds = {
    left: -ITEM_CELL_MARGIN,
    top: ITEM_CELL_MARGIN + 0.5,
    right: maxX,
    bottom: maxY,
  };

  let onStart = onDragStart ? () => {
    onDragStart(item);
  } : OnDragEmpty;
  return <Draggable onStart={onStart} position={position} onStop={onDragStop} bounds={bounds}
                    defaultPosition={defaultPosition}>
    <div className='item-grid-item grabbable-invisible'>
      <MineralSvg width={50} height={50} fillColor={getColor(item.item_type)} strokeColor="#00000000"/>
      <div className="quantity">{item.quantity}</div>
    </div>
  </Draggable>;
};