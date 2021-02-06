#[cfg(test)]
mod inventory_test {
    use crate::inventory::{InventoryItem, InventoryItemType, consume_items_of_type};
    use crate::new_id;

    pub fn comm_min(q: i32) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            value: 0,
            quantity: q,
            stackable: false,
            player_owned: false,
            item_type: InventoryItemType::CommonMineral
        }
    }

    pub fn rare_min(q: i32) -> InventoryItem {
        InventoryItem {
            id: new_id(),
            index: 0,
            value: 0,
            quantity: q,
            stackable: false,
            player_owned: false,
            item_type: InventoryItemType::RareMineral
        }
    }

    #[test]
    pub fn can_consume() {
        let mut inv = vec![comm_min(1), rare_min(2), comm_min(3), rare_min(4)];
        let consumed = consume_items_of_type(&mut inv, InventoryItemType::CommonMineral);
        assert_eq!(inv.len(), 1);
        assert_eq!(inv[0].quantity, 6);
        assert_eq!(consumed.len(), 1);
        assert_eq!(consumed[0].quantity, 4);
    }

}
