use crate::world;
use crate::world::NatSpawnMineral;
use uuid::Uuid;

pub fn find_mineral(loc: &world::Location, id: Uuid) -> Option<&NatSpawnMineral> {
    loc.minerals.iter().find(|m| m.id == id)
}
