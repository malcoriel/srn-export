use crate::world;
use crate::world::{Container, NatSpawnMineral};
use uuid::Uuid;

pub fn find_mineral(loc: &world::Location, id: Uuid) -> Option<&NatSpawnMineral> {
    loc.minerals.iter().find(|m| m.id == id)
}

pub fn find_container(loc: &world::Location, id: Uuid) -> Option<&Container> {
    loc.containers.iter().find(|m| m.id == id)
}
