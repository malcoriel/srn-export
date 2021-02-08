import React from 'react';
import { IVector } from '../utils/Vector';
import { InventoryItem, InventoryItemType } from '../world';
import Draggable from 'react-draggable';
import { ITEM_CELL_MARGIN, OnDragEmpty, OnDragItem } from './ItemGrid';
import { common, gray, rare, uncommon } from '../utils/palette';
import MineralSvg from './ui/MineralSvg';
import BoxPng from "../../public/resources/box.png";

const itemTypeToColor = {
  [InventoryItemType.Unknown]: gray,
  [InventoryItemType.CommonMineral]: common,
  [InventoryItemType.UncommonMineral]: uncommon,
  [InventoryItemType.RareMineral]: rare,
  [InventoryItemType.QuestCargo]: gray,
};


const getColor = (iit: InventoryItemType) : string =>  {
  return itemTypeToColor[iit] || defaultColor;
}
const renderItem = (item: InventoryItem) => {
  if (item.item_type === InventoryItemType.QuestCargo) {
    return <div style={{width: 50, height: 50, margin: 5}}><img draggable={false} src={BoxPng} width={40} height={40} alt='' /></div>
  }
  return <MineralSvg width={50} height={50} fillColor={getColor(item.item_type)} strokeColor="#00000000"/>
}

const defaultColor = gray;



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
      {renderItem(item)}
      {item.quantity !==1 && <div className="quantity">{item.quantity}</div>}
    </div>
  </Draggable>;
};
