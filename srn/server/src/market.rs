use crate::inventory::{InventoryItemType, InventoryItem};
use crate::world::{GameState, find_player_and_ship_mut};
use crate::inventory::{consume_items_of_type, add_item};
use uuid::Uuid;
use std::collections::HashMap;
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use serde_derive::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Market {
    pub wares: HashMap<Uuid, Vec<InventoryItem>>,
    pub prices: HashMap<Uuid, HashMap<InventoryItemType, Price>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Price {
    pub sell: i32,
    pub buy: i32,
}

impl Market {
    pub fn new() -> Market {
        Market {
            wares: HashMap::new(),
            prices: Default::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TradeAction {
    pub planet_id: Uuid,
    pub sells_to_planet: Vec<(InventoryItemType, i32)>,
    pub buys_from_planet: Vec<(InventoryItemType, i32)>,
}

pub fn attempt_trade(state: &mut GameState, player_id: Uuid, act: TradeAction) {
    let mut planet_inventory = state.market.wares.entry(act.planet_id).or_insert(vec![]).clone();
    let planet_prices = &state.market.prices.entry(act.planet_id).or_insert(make_default_prices()).clone();
    let (player, ship) = find_player_and_ship_mut(state, player_id);
    if player.is_none() || ship.is_none() {
        return;
    }
    let player = player.unwrap();
    let ship = ship.unwrap();
    for sell in act.sells_to_planet {
        let price = planet_prices.get(&sell.0);
        if let Some(price) = price {
            let target_items_ship = consume_items_of_type(&mut ship.inventory, &sell.0);
            let mut target_stack = target_items_ship.into_iter().nth(0).unwrap();
            if target_stack.quantity >= sell.1 && sell.1 > 0 {
                let mut cloned_stack = target_stack.clone();
                target_stack.quantity -= sell.1;
                cloned_stack.quantity = sell.1;
                if target_stack.quantity > 0 {
                    add_item(&mut ship.inventory, target_stack);
                }
                add_item(&mut planet_inventory, cloned_stack);
                player.money += price.buy * sell.1
            }
        }
    }
    for buy in act.buys_from_planet {
        let price = planet_prices.get(&buy.0);
        if let Some(price) = price {
            let target_items_planet = consume_items_of_type(&mut planet_inventory, &buy.0);
            let mut target_stack = target_items_planet.into_iter().nth(0).unwrap();
            let total_price = price.sell * buy.1;
            if target_stack.quantity >= buy.1 && buy.1 > 0 && player.money >= total_price {
                let mut cloned_stack = target_stack.clone();
                target_stack.quantity -= buy.1;
                cloned_stack.quantity = buy.1;
                if target_stack.quantity > 0 {
                    add_item(&mut planet_inventory, target_stack);
                }
                add_item(&mut ship.inventory, cloned_stack);
                player.money -= total_price
            }
        }
    }
    state.market.wares.insert(act.planet_id, planet_inventory);
}

fn make_default_prices() -> HashMap<InventoryItemType, Price> {
    let mut res = HashMap::new();
    for item in InventoryItemType::iter() {
        let it: InventoryItemType = item;
        let price = match it {
            InventoryItemType::Unknown => {
                Price { sell: 0, buy: 0 }
            }
            InventoryItemType::CommonMineral => {
                Price { sell: 110, buy: 90 }
            }
            InventoryItemType::UncommonMineral => {
                Price { sell: 220, buy: 180 }
            }
            InventoryItemType::RareMineral => {
                Price { sell: 540, buy: 460 }
            }
            InventoryItemType::QuestCargo => {
                Price { sell: 1000, buy: 0 }
            }
            InventoryItemType::Food => {
                Price { sell: 50, buy: 40 }
            }
            InventoryItemType::Medicament => {
                Price { sell: 160, buy: 140 }
            }
            InventoryItemType::HandWeapon => {
                Price { sell: 250, buy: 200 }
            }
        };
        res.insert(it, price);
    }
    res
}

pub fn get_default_value(it: &InventoryItemType) -> i32  {
    match it {
        InventoryItemType::Unknown => {
            0
        }
        InventoryItemType::CommonMineral => {
            100
        }
        InventoryItemType::UncommonMineral => {
            200
        }
        InventoryItemType::RareMineral => {
            500
        }
        InventoryItemType::QuestCargo => {
            0
        }
        InventoryItemType::Food => {
            45
        }
        InventoryItemType::Medicament => {
            150
        }
        InventoryItemType::HandWeapon => {
            225
        }
    }
}

