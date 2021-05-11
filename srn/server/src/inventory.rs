use std::collections::{HashMap, HashSet};
use std::mem;

use rand::rngs::SmallRng;
use rand::{Rng, RngCore, SeedableRng};
use serde_derive::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;

use crate::new_id;
use crate::tractoring::IMovable;
use crate::world::{NatSpawnMineral, Rarity};

#[derive(
    Serialize,
    Deserialize,
    Debug,
    Clone,
    PartialEq,
    Eq,
    Hash,
    EnumIter,
    TypescriptDefinition,
    TypeScriptify,
)]
pub enum InventoryItemType {
    Unknown,
    CommonMineral,
    UncommonMineral,
    RareMineral,
    QuestCargo,
    Food,
    Medicament,
    HandWeapon,
}

#[derive(Serialize, TypescriptDefinition, TypeScriptify, Deserialize, Debug, Clone)]
#[serde(tag = "tag")]
pub enum InventoryAction {
    Unknown,
    Split { from: Uuid, count: i32 },
    Merge { from: Uuid, to: Uuid },
    Move { item: Uuid, index: i32 },
}

pub static MINERAL_TYPES: [InventoryItemType; 3] = [
    InventoryItemType::CommonMineral,
    InventoryItemType::UncommonMineral,
    InventoryItemType::RareMineral,
];

pub fn inventory_item_type_to_stackable(iit: &InventoryItemType) -> bool {
    match iit {
        InventoryItemType::Unknown => false,
        InventoryItemType::CommonMineral => true,
        InventoryItemType::UncommonMineral => true,
        InventoryItemType::RareMineral => true,
        InventoryItemType::QuestCargo => false,
        InventoryItemType::Food => true,
        InventoryItemType::Medicament => true,
        InventoryItemType::HandWeapon => true,
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct InventoryItem {
    pub id: Uuid,
    pub index: i32,
    pub quantity: i32,
    pub value: i32,
    pub stackable: bool,
    pub player_owned: bool,
    pub item_type: InventoryItemType,
    pub quest_id: Option<Uuid>,
}

impl InventoryItem {
    pub fn from(_mov: Box<dyn IMovable>) -> Vec<InventoryItem> {
        todo!()
    }
    pub fn new(iit: InventoryItemType, quantity: i32) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            quantity,
            value: 0,
            stackable: inventory_item_type_to_stackable(&iit),
            player_owned: false,
            item_type: iit,
            quest_id: None,
        }
    }

    pub fn random(prng: &mut SmallRng) -> InventoryItem {
        let possible = vec![
            InventoryItemType::CommonMineral,
            InventoryItemType::UncommonMineral,
            InventoryItemType::RareMineral,
            InventoryItemType::Food,
            InventoryItemType::Medicament,
            InventoryItemType::HandWeapon,
        ];
        let index = prng.gen_range(0, possible.len());
        return InventoryItem::new(possible[index].clone(), prng.gen_range(1, 6));
    }

    pub fn quest_pickup(quest_id: Uuid) -> InventoryItem {
        InventoryItem {
            id: Default::default(),
            index: 0,
            quantity: 1,
            value: 0,
            stackable: false,
            player_owned: true,
            item_type: InventoryItemType::QuestCargo,
            quest_id: Some(quest_id),
        }
    }

    pub fn from_mineral(mineral: NatSpawnMineral) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            quantity: 1,
            value: mineral.value,
            stackable: true,
            player_owned: true,
            item_type: match mineral.rarity {
                Rarity::Unknown => InventoryItemType::Unknown,
                Rarity::Common => InventoryItemType::CommonMineral,
                Rarity::Uncommon => InventoryItemType::UncommonMineral,
                Rarity::Rare => InventoryItemType::RareMineral,
            },
            quest_id: None,
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
    cloned_inv = cloned_inv
        .into_iter()
        .filter(|e| e.id != Uuid::nil())
        .collect::<Vec<_>>();
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

pub fn add_items(inventory: &mut Vec<InventoryItem>, new_items: Vec<InventoryItem>) {
    for item in new_items.into_iter() {
        add_item(inventory, item);
    }
}

pub fn remove_quest_item(
    inventory: &mut Vec<InventoryItem>,
    quest_id: Uuid,
) -> Option<InventoryItem> {
    let pos = find_quest_item_pos(inventory, quest_id);
    pos.map(|p| inventory.remove(p))
}

pub fn has_quest_item(inventory: &Vec<InventoryItem>, quest_id: Uuid) -> bool {
    let pos = find_quest_item_pos(inventory, quest_id);
    return pos.is_some();
}

fn find_quest_item_pos(inventory: &Vec<InventoryItem>, quest_id: Uuid) -> Option<usize> {
    let pos = inventory.iter().position(|i| {
        i.item_type == InventoryItemType::QuestCargo
            && i.quest_id.map(|id| id == quest_id).unwrap_or(false)
    });
    pos
}

pub fn merge_item_stacks(inventory: &mut Vec<InventoryItem>, from: Uuid, to: Uuid) {
    let moved = inventory.iter().position(|i| i.id == from);
    if let Some(moved) = moved {
        let picked = inventory.remove(moved);
        let accepting = inventory.iter().position(|i| i.id == to);
        if let Some(accepting) = accepting {
            let accepting = inventory.iter_mut().nth(accepting);
            if let Some(accepting) = accepting {
                accepting.quantity += picked.quantity;
            }
        }
    } else {
        warn!(format!(
            "Invalid merge for non-existent item ids (or one of them): {} and {}",
            from, to
        ));
    }
}

pub fn split_item_stack(inventory: &mut Vec<InventoryItem>, item_id: Uuid, count: i32) {
    let (by_index, by_id) = double_index_items(inventory);
    let target = inventory.iter_mut().find(|i| i.id == item_id);
    if target.is_none() {
        warn!(format!(
            "Invalid split for non-existent item id: {}",
            item_id
        ));
        return;
    }
    let target = target.unwrap();
    if target.quantity <= count {
        warn!(format!(
            "Invalid split for item id: {}, available {}, split {} (must be greater)",
            item_id, target.quantity, count
        ));
        return;
    }
    let mut free_index = by_id.get(&item_id).unwrap().clone() + 1;
    while by_index.get(&free_index).is_some() {
        free_index += 1;
    }
    target.quantity -= count;
    let target_clone = target.clone();
    inventory.push(InventoryItem {
        id: new_id(),
        index: free_index,
        quantity: count,
        value: target_clone.value,
        stackable: target_clone.stackable,
        player_owned: target_clone.player_owned,
        item_type: target_clone.item_type.clone(),
        quest_id: target_clone.quest_id,
    })
}

pub fn consume_items_of_type(
    inventory: &mut Vec<InventoryItem>,
    iit: &InventoryItemType,
) -> Vec<InventoryItem> {
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

    cloned_inv = cloned_inv
        .into_iter()
        .filter(|e| e.id != Uuid::nil())
        .collect::<Vec<_>>();
    group_items_of_same_type(&mut cloned_inv);
    // replace the contents with the filtered ones
    inventory.clear();
    inventory.append(&mut cloned_inv);
    res = res
        .into_iter()
        .map(|mut item: InventoryItem| {
            item.id = new_id();
            item
        })
        .collect::<Vec<_>>();
    group_items_of_same_type(&mut res);
    return res;
}

pub fn consume_items_of_types(
    inventory: &mut Vec<InventoryItem>,
    types: &Vec<InventoryItemType>,
) -> Vec<InventoryItem> {
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

pub fn double_index_items(
    inventory: &Vec<InventoryItem>,
) -> (HashMap<i32, Uuid>, HashMap<Uuid, i32>) {
    let mut by_index = HashMap::new();
    let mut by_id = HashMap::new();
    for item in inventory {
        by_index.insert(item.index.clone(), item.id.clone());
        by_id.insert(item.id.clone(), item.index.clone());
    }
    return (by_index, by_id);
}

pub fn index_items_by_id_mut(
    inventory: &mut Vec<InventoryItem>,
) -> HashMap<Uuid, &mut InventoryItem> {
    let mut by_id = HashMap::new();
    for item in inventory.iter_mut() {
        by_id.insert(item.id.clone(), item);
    }
    return by_id;
}

pub fn apply_action(inventory: &mut Vec<InventoryItem>, action: InventoryAction) {
    match action {
        InventoryAction::Unknown => {}
        InventoryAction::Split { from, count } => {
            split_item_stack(inventory, from, count);
        }
        InventoryAction::Merge { from, to } => {
            merge_item_stacks(inventory, from, to);
        }
        InventoryAction::Move { item, index } => move_item_stack(inventory, action, &item, index),
    }
}

fn move_item_stack(
    inventory: &mut Vec<InventoryItem>,
    action: InventoryAction,
    item: &Uuid,
    index: i32,
) {
    let (by_index, _by_id) = double_index_items(inventory);
    let mut items = index_items_by_id_mut(inventory);
    if let Some(mut moved_item) = items.get_mut(&item) {
        if by_index.get(&index).is_some() {
            warn!(format!(
                "Invalid move action {:?}, index {} already occupied",
                action, index
            ));
        } else if index < 0 {
            warn!(format!(
                "Invalid move action {:?}, index {}<0",
                action, index
            ));
        } else {
            moved_item.index = index;
        }
    }
}

pub fn cleanup_inventory_from_zeros(inventory: &mut Vec<InventoryItem>) {
    let mut tmp = inventory
        .iter()
        .filter_map(|item| {
            if item.quantity > 0 {
                Some(item.clone())
            } else {
                None
            }
        })
        .collect::<Vec<_>>();
    mem::swap(&mut tmp, inventory);
}
