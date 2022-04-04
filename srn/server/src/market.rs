use std::collections::HashMap;

use rand_pcg::Pcg64Mcg;
use rand::prelude::*;
use rand::Rng;
use serde_derive::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use strum_macros::EnumIter;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use uuid::Uuid;
use wasm_bindgen::prelude::*;


use crate::indexing::find_player_and_ship_mut;
use crate::inventory::{add_item, consume_items_of_type};
use crate::inventory::{
    add_items, cleanup_inventory_from_zeros, inventory_item_type_to_stackable, shake_items,
    InventoryItem, InventoryItemType,
};
use crate::{prng_id};
use crate::world::{GameState, Planet};

pub type Wares = HashMap<Uuid, Vec<InventoryItem>>;
pub type Prices = HashMap<Uuid, HashMap<InventoryItemType, Price>>;

pub const SHAKE_MARKET_EVERY_TICKS: i64 = 60 * 1000 * 1000;

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Market {
    pub wares: HashMap<Uuid, Vec<InventoryItem>>,
    pub prices: HashMap<Uuid, HashMap<InventoryItemType, Price>>,
    pub time_before_next_shake: i64,
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct Price {
    pub sell: i32,
    pub buy: i32,
}

impl Market {
    pub fn new() -> Market {
        Market {
            wares: HashMap::new(),
            prices: Default::default(),
            time_before_next_shake: 1000,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct TradeAction {
    pub planet_id: Uuid,
    pub sells_to_planet: Vec<(InventoryItemType, i32)>,
    pub buys_from_planet: Vec<(InventoryItemType, i32)>,
}

pub fn init_planet_market(state: &mut GameState, planet_id: Uuid) {
    state
        .market
        .prices
        .entry(planet_id)
        .or_insert(make_default_prices());
}

pub fn init_all_planets_market(state: &mut GameState) {
    let mut ids = vec![];
    for loc in state.locations.iter() {
        let mut ids2 = loc.planets.iter().map(|p| p.id.clone()).collect::<Vec<_>>();
        ids.append(&mut ids2);
    }
    for planet_id in ids {
        init_planet_market(state, planet_id);
    }
}

pub fn attempt_trade(state: &mut GameState, player_id: Uuid, act: TradeAction, prng: &mut Pcg64Mcg) {
    let mut planet_inventory = state
        .market
        .wares
        .entry(act.planet_id)
        .or_insert(vec![])
        .clone();
    let planet_prices = &state
        .market
        .prices
        .entry(act.planet_id)
        .or_insert(make_default_prices())
        .clone();
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
            if target_items_ship.len() == 1 {
                let total_price = price.buy * sell.1;
                // log!(format!(
                //     "executing sell of {} {:?} for {}",
                //     sell.1, sell.0, total_price
                // ));
                let mut target_stack = target_items_ship.into_iter().nth(0).unwrap();
                if target_stack.quantity >= sell.1 && sell.1 > 0 {
                    let mut cloned_stack = target_stack.clone();
                    cloned_stack.id = prng_id(prng);
                    target_stack.quantity -= sell.1;
                    cloned_stack.quantity = sell.1;
                    if target_stack.quantity > 0 {
                        add_item(&mut ship.inventory, target_stack);
                    }
                    add_item(&mut planet_inventory, cloned_stack);
                    player.money += total_price
                } else {
                    log!(format!(
                        "not enough quantity or negative sell, {} requested, {} available",
                        sell.1, target_stack.quantity
                    ));
                    target_stack.id = prng_id(prng);
                    add_item(&mut ship.inventory, target_stack);
                }
            } else {
                warn!(format!("invalid sell of {:?} quantity {} on planet {} by {}, no stacks found in player inventory", sell.0, sell.1, act.planet_id, player.id));
                add_items(&mut ship.inventory, target_items_ship);
            }
        }
    }
    for buy in act.buys_from_planet {
        let price = planet_prices.get(&buy.0);
        if let Some(price) = price {
            let target_items_planet = consume_items_of_type(&mut planet_inventory, &buy.0);
            if target_items_planet.len() == 1 {
                let mut target_stack = target_items_planet.into_iter().nth(0).unwrap();
                let total_price = price.sell * buy.1;
                // log!(format!(
                //     "executing buy of {} {:?} for {}",
                //     buy.1, buy.0, total_price
                // ));
                if target_stack.quantity >= buy.1 && buy.1 > 0 {
                    if player.money >= total_price {
                        let mut cloned_stack = target_stack.clone();
                        target_stack.quantity -= buy.1;
                        cloned_stack.id = prng_id(prng);
                        cloned_stack.quantity = buy.1;
                        if target_stack.quantity > 0 {
                            add_item(&mut planet_inventory, target_stack);
                        }
                        add_item(&mut ship.inventory, cloned_stack);
                        player.money -= total_price
                    } else {
                        log!(format!(
                            "not enough money on player, {} needed, {} available",
                            total_price, player.money
                        ));
                        target_stack.id = prng_id(prng);
                        add_item(&mut planet_inventory, target_stack);
                    }
                } else {
                    log!(format!(
                        "not enough quantity or negative buy, {} requested, {} available",
                        buy.1, target_stack.quantity
                    ));
                    add_item(&mut planet_inventory, target_stack);
                }
            } else {
                add_items(&mut planet_inventory, target_items_planet);
                warn!(format!("invalid buy of {:?} quantity {} on planet {} by {}, no stacks found in planet inventory", buy.0, buy.1, act.planet_id, player.id))
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
            InventoryItemType::Unknown => Price { sell: 0, buy: 0 },
            InventoryItemType::CommonMineral => Price { sell: 110, buy: 90 },
            InventoryItemType::UncommonMineral => Price {
                sell: 220,
                buy: 180,
            },
            InventoryItemType::RareMineral => Price {
                sell: 540,
                buy: 460,
            },
            InventoryItemType::QuestCargo => Price { sell: 1000, buy: 0 },
            InventoryItemType::Food => Price { sell: 50, buy: 40 },
            InventoryItemType::Medicament => Price {
                sell: 160,
                buy: 140,
            },
            InventoryItemType::HandWeapon => Price {
                sell: 250,
                buy: 200,
            },
        };
        res.insert(it, price);
    }
    res
}

fn make_default_wares(prng: &mut Pcg64Mcg) -> Vec<InventoryItem> {
    let mut res = vec![];
    for item in InventoryItemType::iter() {
        let it: InventoryItemType = item;
        let item = match it {
            InventoryItemType::Unknown => InventoryItem::new(it, 0, prng_id(prng)),
            InventoryItemType::CommonMineral => InventoryItem::new(it, 100, prng_id(prng)),
            InventoryItemType::UncommonMineral => InventoryItem::new(it, 50, prng_id(prng)),
            InventoryItemType::RareMineral => InventoryItem::new(it, 20, prng_id(prng)),
            InventoryItemType::QuestCargo => InventoryItem::new(it, 0, prng_id(prng)),
            InventoryItemType::Food => InventoryItem::new(it, 200, prng_id(prng)),
            InventoryItemType::Medicament => InventoryItem::new(it, 50, prng_id(prng)),
            InventoryItemType::HandWeapon => InventoryItem::new(it, 10, prng_id(prng)),
        };
        if item.quantity != 0 {
            res.push(item);
        }
    }
    shake_items(&mut res);
    res
}

pub fn get_default_value(it: &InventoryItemType) -> i32 {
    match it {
        InventoryItemType::Unknown => 0,
        InventoryItemType::CommonMineral => 100,
        InventoryItemType::UncommonMineral => 200,
        InventoryItemType::RareMineral => 500,
        InventoryItemType::QuestCargo => 0,
        InventoryItemType::Food => 45,
        InventoryItemType::Medicament => 150,
        InventoryItemType::HandWeapon => 225,
    }
}

pub fn gen_price_event(rng: &mut Pcg64Mcg) -> PriceEvent {
    let roll = rng.gen_range(0, 100);
    match roll {
        0..71 => PriceEvent::Normalize,
        71..81 => PriceEvent::FoodShortage,
        81..86 => PriceEvent::CivilWar,
        86..96 => PriceEvent::IndustrialBoom,
        96..100 => PriceEvent::Epidemic,
        _ => PriceEvent::Unknown,
    }
}

pub fn shake_market(planets: Vec<Planet>, wares: &mut Wares, prices: &mut Prices, prng: &mut Pcg64Mcg) {
    for planet in planets {
        let planet_prices = prices.entry(planet.id).or_insert(make_default_prices());
        let planet_wares = wares.entry(planet.id).or_insert(make_default_wares(prng));
        shift_market(planet_prices, planet_wares, planet.name.clone(), prng);
    }
}

pub fn shift_market(
    prices: &mut HashMap<InventoryItemType, Price>,
    wares: &mut Vec<InventoryItem>,
    _planet_name: String,
    prng: &mut Pcg64Mcg
) {
    let event = gen_price_event(prng);
    // log!(format!("Market event {:?} on {}", event, planet_name));
    apply_price_event(prices, event, wares, prng);
}

const NORMALIZE_DRIFT_PRICE_PERCENTAGE_PER_EVENT: f64 = 20.0;
const NORMALIZE_DRIFT_ITEM_PERCENTAGE_PER_EVENT: f64 = 10.0;

pub fn index_items_by_type(
    items: &mut Vec<InventoryItem>,
) -> HashMap<InventoryItemType, &mut InventoryItem> {
    let mut res = HashMap::new();
    for item in items.iter_mut() {
        res.insert(item.item_type.clone(), item);
    }
    return res;
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum PriceEvent {
    Unknown,
    Normalize,
    FoodShortage,
    CivilWar,
    IndustrialBoom,
    Epidemic,
}

pub fn apply_price_event(
    prices: &mut HashMap<InventoryItemType, Price>,
    event: PriceEvent,
    wares: &mut Vec<InventoryItem>,
    prng: &mut Pcg64Mcg
) {
    match event {
        PriceEvent::Unknown => {}
        PriceEvent::Normalize => apply_normalize_event(prices, wares, prng),
        PriceEvent::FoodShortage => {
            set_quantity(wares, &InventoryItemType::Food, QuantityVariant::Scarce, prng);
            set_price(prices, &InventoryItemType::Food, PriceVariant::Deficit);
            set_price(
                prices,
                &InventoryItemType::CommonMineral,
                PriceVariant::Stagnated,
            );
            cleanup_inventory_from_zeros(wares);
        }
        PriceEvent::CivilWar => {
            set_quantity(wares, &InventoryItemType::Food, QuantityVariant::Low, prng);
            set_price(prices, &InventoryItemType::Food, PriceVariant::Deficit);
            set_quantity(
                wares,
                &InventoryItemType::HandWeapon,
                QuantityVariant::Abundant,
                prng,
            );
            set_price(
                prices,
                &InventoryItemType::HandWeapon,
                PriceVariant::Prospering,
            );
            set_price(
                prices,
                &InventoryItemType::Medicament,
                PriceVariant::Deficit,
            );
            set_price(
                prices,
                &InventoryItemType::CommonMineral,
                PriceVariant::Stagnated,
            );
            set_quantity(wares, &InventoryItemType::CommonMineral, QuantityVariant::Zero, prng);
            cleanup_inventory_from_zeros(wares);
        }
        PriceEvent::IndustrialBoom => {
            set_quantity(
                wares,
                &InventoryItemType::CommonMineral,
                QuantityVariant::Overwhelming,
                prng
            );
            set_price(
                prices,
                &InventoryItemType::CommonMineral,
                PriceVariant::Abundance,
            );
            set_price(prices, &InventoryItemType::Food, PriceVariant::Booming);
            set_price(
                prices,
                &InventoryItemType::HandWeapon,
                PriceVariant::Abundance,
            );
            set_quantity(
                wares,
                &InventoryItemType::HandWeapon,
                QuantityVariant::Abundant,
                prng
            );
        }
        PriceEvent::Epidemic => {
            set_quantity(wares, &InventoryItemType::Medicament, QuantityVariant::Zero, prng);
            set_price(
                prices,
                &InventoryItemType::Medicament,
                PriceVariant::Deficit,
            );
            set_price(prices, &InventoryItemType::Food, PriceVariant::Deficit);
            set_price(
                prices,
                &InventoryItemType::HandWeapon,
                PriceVariant::Stagnated,
            );
            set_price(
                prices,
                &InventoryItemType::CommonMineral,
                PriceVariant::Stagnated,
            );
            set_quantity(
                wares,
                &InventoryItemType::CommonMineral,
                QuantityVariant::Low,
                prng
            );
        }
    }
}

fn apply_normalize_event(
    prices: &mut HashMap<InventoryItemType, Price>,
    wares: &mut Vec<InventoryItem>,
    prng: &mut Pcg64Mcg
) {
    let default_prices = make_default_prices();
    for (it, price) in prices {
        let default = default_prices.get(&it).unwrap();
        let sell_diff = ((default.sell - price.sell) as f64 / 100.0
            * NORMALIZE_DRIFT_PRICE_PERCENTAGE_PER_EVENT) as i32;
        price.sell += sell_diff;
        let buy_diff = ((default.buy - price.buy) as f64 / 100.0
            * NORMALIZE_DRIFT_PRICE_PERCENTAGE_PER_EVENT) as i32;
        price.buy += buy_diff;
    }
    shake_items(wares);

    let mut indexed_by_type = index_items_by_type(wares);
    let mut default_wares = make_default_wares(prng);
    let default_indexed = index_items_by_type(&mut default_wares);
    let mut new_items = vec![];
    for it in InventoryItemType::iter() {
        let it: InventoryItemType = it;
        let diff: i32 = if let Some(default_quantity) = default_indexed.get(&it).map(|i| i.quantity)
        {
            let current_quantity = indexed_by_type.get(&it).map_or(0, |it| it.quantity);
            ((default_quantity - current_quantity) as f64 / 100.0
                * NORMALIZE_DRIFT_ITEM_PERCENTAGE_PER_EVENT) as i32
        } else {
            0
        };
        if diff != 0 {
            if let Some(item) = indexed_by_type.get_mut(&it) {
                item.quantity += diff;
            } else {
                new_items.push(InventoryItem::new(it, diff, prng_id(prng)));
            }
        }
    }
    wares.extend(new_items.into_iter());
    cleanup_inventory_from_zeros(wares)
}

enum QuantityVariant {
    Zero,
    Scarce,
    Low,
    Normal,
    Abundant,
    Booming,
    Overwhelming,
}

enum PriceVariant {
    Normal,
    Stagnated,
    Booming,
    Prospering,
    Deficit,
    Abundance,
}

fn set_price(
    prices: &mut HashMap<InventoryItemType, Price>,
    target_type: &InventoryItemType,
    variant: PriceVariant,
) {
    let default_prices = make_default_prices();
    let default_price = default_prices.get(&target_type).unwrap();
    let new_price = match variant {
        PriceVariant::Normal => Price {
            sell: (default_price.sell as f64 * 1.0) as i32,
            buy: (default_price.buy as f64 * 1.0) as i32,
        },
        PriceVariant::Stagnated => Price {
            sell: (default_price.sell as f64 * 0.5) as i32,
            buy: (default_price.buy as f64 * 0.5) as i32,
        },
        PriceVariant::Booming => Price {
            sell: (default_price.sell as f64 * 1.5) as i32,
            buy: (default_price.buy as f64 * 1.5) as i32,
        },
        PriceVariant::Prospering => Price {
            sell: (default_price.sell as f64 * 2.0) as i32,
            buy: (default_price.buy as f64 * 2.0) as i32,
        },
        PriceVariant::Deficit => Price {
            sell: (default_price.sell as f64 * 1.5) as i32,
            buy: (default_price.buy as f64 * 2.5) as i32,
        },
        PriceVariant::Abundance => Price {
            sell: (default_price.sell as f64 * 0.75) as i32,
            buy: (default_price.buy as f64 * 0.25) as i32,
        },
    };
    prices.insert(target_type.clone(), new_price);
}

fn set_quantity(
    wares: &mut Vec<InventoryItem>,
    target_type: &InventoryItemType,
    variant: QuantityVariant,
    prng: &mut Pcg64Mcg
) {
    let mut indexed_by_type = index_items_by_type(wares);

    let mut default_wares = make_default_wares(prng);
    let default_quantity = index_items_by_type(&mut default_wares)
        .get(&target_type)
        .map_or(0, |i| i.quantity);
    let new_quantity = match variant {
        QuantityVariant::Zero => 0,
        QuantityVariant::Scarce => (default_quantity as f64 * 0.3) as i32,
        QuantityVariant::Low => (default_quantity as f64 * 0.6) as i32,
        QuantityVariant::Normal => (default_quantity as f64 * 1.0) as i32,
        QuantityVariant::Abundant => (default_quantity as f64 * 1.5) as i32,
        QuantityVariant::Booming => (default_quantity as f64 * 2.25) as i32,
        QuantityVariant::Overwhelming => (default_quantity as f64 * 3.0) as i32,
    };
    let result = if let Some(mut item) = indexed_by_type.get_mut(&target_type) {
        item.quantity = new_quantity;
        None
    } else {
        Some(InventoryItem::new(target_type.clone(), new_quantity, prng_id(prng)))
    };
    if result.is_some() {
        wares.push(result.unwrap());
    }
}
