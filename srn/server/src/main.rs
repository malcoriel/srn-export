#![feature(proc_macro_hygiene, decl_macro)]
#[cfg(feature = "serde_derive")]
#[allow(unused_imports)]
#[macro_use]
extern crate serde_derive;
#[cfg(feature = "serde_derive")]
#[doc(hidden)]
pub use serde_derive::*;
use std::sync::RwLock;
#[macro_use]
extern crate rocket;
use rocket_contrib::json::Json;

use crate::game::{GameState, Planet, Player, Ship};
mod game;
mod vec2;

use rocket::http::Method;
use rocket_cors::{AllowedHeaders, AllowedOrigins};
use std::error::Error;

use lazy_static::lazy_static;

lazy_static! {
    static ref STATE: RwLock<GameState> = RwLock::new(GameState {
        tick: 0,
        planets: vec![
            Planet {
                id: 1,
                x: 0.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.0,
            },
            Planet {
                id: 2,
                x: 10.0,
                y: 10.0,
                rotation: 0.0,
                radius: 3.0,
            },
            Planet {
                id: 3,
                x: 5.0,
                y: 0.0,
                rotation: 0.0,
                radius: 0.5,
            },
            Planet {
                id: 6,
                x: 0.0,
                y: 5.0,
                rotation: 0.0,
                radius: 0.5,
            },
        ],
        ships: vec![
            Ship {
                id: 4,
                x: 0.0,
                y: 0.0,
                rotation: 0.0,
                radius: 1.0,
            },
            Ship {
                id: 5,
                x: 1.0,
                y: 3.0,
                rotation: 1.57,
                radius: 1.0,
            },
        ],
        players: vec![Player { id: 1, ship_id: 4 }],
    });
}

#[get("/state")]
fn get_state() -> Json<GameState> {
    Json(STATE.read().unwrap().clone())
}

#[post("/state", data = "<state>")]
fn post_state(state: Json<GameState>) -> () {
    let mut mut_state = STATE.write().unwrap();
    mut_state.ships = state.ships.clone();
    mut_state.tick = mut_state.tick + 1;
}

fn main() -> Result<(), Box<dyn Error>> {
    let allowed_origins = AllowedOrigins::some_exact(&["http://localhost:3000"]);

    // You can also deserialize this
    let cors = rocket_cors::CorsOptions {
        allowed_origins,
        allowed_methods: vec![Method::Get, Method::Post, Method::Options]
            .into_iter()
            .map(From::from)
            .collect(),
        allowed_headers: AllowedHeaders::some(&[
            "Authorization",
            "Accept",
            "Content-Type",
            "Content-Length",
        ]),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()?;
    rocket::ignite()
        .attach(cors)
        .mount("/api", routes![get_state, post_state])
        .launch();
    Ok(())
}
