use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};
use crate::world::{NatSpawnMineral, Rarity};
use std::collections::HashSet;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum InventoryItemType {
    Unknown,
    CommonMineral,
    UncommonMineral,
    RareMineral,
}

pub fn inventory_item_type_to_stackable(iit: &InventoryItemType) -> bool {
    match iit {
        InventoryItemType::Unknown => false,
        InventoryItemType::CommonMineral => true,
        InventoryItemType::UncommonMineral => true,
        InventoryItemType::RareMineral => true
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InventoryItem {
    pub id: Uuid,
    pub index: i32,
    pub quantity: i32,
    pub stackable: bool,
    pub player_owned: bool,
    pub item_type: InventoryItemType,
}

impl InventoryItem {
    pub fn new(iit: InventoryItemType, quantity: i32) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            quantity,
            stackable: inventory_item_type_to_stackable(&iit),
            player_owned: false,
            item_type: iit,
        }
    }

    pub fn from_mineral(mineral: NatSpawnMineral) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            quantity: 1,
            stackable: true,
            player_owned: false,
            item_type: match mineral.rarity {
                Rarity::Unknown => { InventoryItemType::Unknown }
                Rarity::Common => { InventoryItemType::CommonMineral }
                Rarity::Uncommon => { InventoryItemType::UncommonMineral }
                Rarity::Rare => { InventoryItemType::RareMineral }
            },
        }
    }
}

// auto-arrange items to unoccupied slots
pub fn shake_items(inventory: &mut Vec<InventoryItem>) {
    let mut occupied = HashSet::new();
    for item in inventory.iter_mut() {
        if !occupied.contains(&item.index) {
            occupied.insert(item.index);
        } else {
            let mut i = item.index;
            while occupied.contains(&i) {
                i +=1;
            }
            item.index = i;
            occupied.insert(i);
        }
    }
}

// auto-stack items when added
pub fn add_item(inventory: &mut Vec<InventoryItem>, new_item: InventoryItem) {
    let mut found_match = false;
    for item in inventory.iter_mut() {
        if item.item_type == new_item.item_type {
            item.quantity += new_item.quantity;
            found_match = true;
            break;
        }
    }
    if !found_match {
        inventory.push(new_item);
    }
    shake_items(inventory);
}

// subtract from stacks, remove zero stacks
pub fn remove(_inventory: Vec<InventoryItem>, _item: InventoryItem) {

}
