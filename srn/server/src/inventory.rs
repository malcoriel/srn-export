use uuid::Uuid;
use crate::new_id;
use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum InventoryItemType {
    Unknown,
    CommonMineral,
    UncommonMineral,
    RareMineral
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
    pub x: i32,
    pub y: i32,
    pub quantity: i32,
    pub stackable: bool,
    pub player_owned: bool,
    pub item_type: InventoryItemType
}

impl InventoryItem {
    pub fn new(iit: InventoryItemType, quantity: i32) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            x: 0,
            y: 0,
            quantity,
            stackable: inventory_item_type_to_stackable(&iit),
            player_owned: false,
            item_type: iit
        }
    }
}
