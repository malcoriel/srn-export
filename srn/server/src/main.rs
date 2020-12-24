#![feature(proc_macro_hygiene, decl_macro)]
#[cfg(feature = "serde_derive")]
#[allow(unused_imports)]
#[macro_use]
extern crate serde_derive;
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;

#[macro_use]
extern crate rocket;
use rocket_contrib::json::Json;

use crate::game::{GameState, Planet, Ship};
mod game;
mod vec2;

#[get("/state")]
fn state() -> Json<GameState> {
    Json(GameState {
        planets: vec![
            Planet {
                id: 1,
                x: 0.0,
                y: 0.0,
                radius: 3.0,
            },
            Planet {
                id: 2,
                x: 5.0,
                y: 10.0,
                radius: 5.0,
            },
            Planet {
                id: 3,
                x: 2.0,
                y: 0.0,
                radius: 0.5,
            },
        ],
        ships: vec![
            Ship {
                id: 4,
                x: 0.0,
                y: 0.0,
                rot: 0.0,
                radius: 0.2,
            },
            Ship {
                id: 5,
                x: 0.0,
                y: 0.5,
                rot: 1.07,
                radius: 0.2,
            },
        ],
    })
}

fn main() {
    rocket::ignite().mount("/", routes![state]).launch();
}
