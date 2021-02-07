use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};
use crate::world::{NatSpawnMineral, Rarity};
use std::collections::{HashSet, HashMap};
use std::mem;

#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq, Hash)]
pub enum InventoryItemType {
    Unknown,
    CommonMineral,
    UncommonMineral,
    RareMineral,
}

pub static MINERAL_TYPES: [InventoryItemType; 3] = [
    InventoryItemType::CommonMineral, InventoryItemType::UncommonMineral, InventoryItemType::RareMineral];

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
    pub value: i32,
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
            value: 0,
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
            value: mineral.value,
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
                i += 1;
            }
            item.index = i;
            occupied.insert(i);
        }
    }
}

pub fn group_items_of_same_type(inventory: &mut Vec<InventoryItem>) {
    let mut iit_to_slot = HashMap::new();
    let mut indexes_to_move = vec![];
    for i in 0..inventory.len() {
        let item = &inventory[i];
        if !iit_to_slot.contains_key(&item.item_type) {
            iit_to_slot.insert(&item.item_type, i);
        } else {
            indexes_to_move.push(i);
        }
    }

    let mut cloned_inv = inventory.clone();
    for i in 0..indexes_to_move.len() {
        cloned_inv[indexes_to_move[i]].id = Uuid::nil();
    }

    for i in 0..indexes_to_move.len() {
        let read_item = &inventory[indexes_to_move[i]];
        let moved_amount = read_item.quantity;
        let base_index = *iit_to_slot.get(&read_item.item_type).unwrap();
        let base_item = &mut cloned_inv[base_index];
        base_item.quantity += moved_amount;
    }
    cloned_inv = cloned_inv.into_iter().filter(|e| e.id != Uuid::nil()).collect::<Vec<_>>();
    inventory.clear();
    inventory.append(&mut cloned_inv);
}

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

// pub fn remove_item(inventory: &mut Vec<InventoryItem>, item: InventoryItem) {
//
// }

pub fn consume_items_of_type(inventory: &mut Vec<InventoryItem>, iit: &InventoryItemType) -> Vec<InventoryItem> {
    let mut res = vec![];
    let mut indexes = vec![];
    let mut cloned_inv = inventory.clone();
    for i in 0..cloned_inv.len() {
        if cloned_inv[i].item_type == *iit {
            indexes.push(i);
        }
    }
    for i in 0..indexes.len() {
        cloned_inv[indexes[i]].id = Uuid::nil();
        res.push(cloned_inv[indexes[i]].clone())
    }

    cloned_inv = cloned_inv.into_iter().filter(|e| e.id != Uuid::nil()).collect::<Vec<_>>();
    group_items_of_same_type(&mut cloned_inv);
    // replace the contents with the filtered ones
    inventory.clear();
    inventory.append(&mut cloned_inv);
    res = res.into_iter().map(|mut item: InventoryItem| {
        item.id = new_id();
        item
    }).collect::<Vec<_>>();
    group_items_of_same_type(&mut res);
    return res;
}

pub fn consume_items_of_types(inventory: &mut Vec<InventoryItem>, types: &Vec<InventoryItemType>) -> Vec<InventoryItem> {
    let mut res = vec![];
    for iit in types {
        let mut extracted = consume_items_of_type(inventory, iit);
        res.append(&mut extracted);
    }
    res
}

pub fn count_items_of_types(inventory: &Vec<InventoryItem>, types: &Vec<InventoryItemType>) -> i32 {
    let mut tmp = inventory.clone();
    group_items_of_same_type(&mut tmp);
    let mut res = 0;
    for iit in types {
        let item = tmp.iter().find(|i| i.item_type == *iit);
        if let Some(item) = item {
            res += item.quantity;
        }
    }
    res
}

pub fn value_items_of_types(inventory: &Vec<InventoryItem>, types: &Vec<InventoryItemType>) -> i32 {
    let mut tmp = inventory.clone();
    group_items_of_same_type(&mut tmp);
    let mut res = 0;
    for iit in types {
        let item = tmp.iter().find(|i| i.item_type == *iit);
        if let Some(item) = item {
            res += item.quantity * item.value;
        }
    }
    res
}