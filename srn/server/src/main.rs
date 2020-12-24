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

use rocket::http::Method;
use rocket_cors::{AllowedHeaders, AllowedOrigins};
use std::error::Error;

#[get("/state")]
fn state() -> Json<GameState> {
    Json(GameState {
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
                radius: 0.2,
            },
            Ship {
                id: 5,
                x: 0.0,
                y: 0.5,
                rotation: 1.07,
                radius: 0.2,
            },
        ],
    })
}

fn main() -> Result<(), Box<dyn Error>> {
    let allowed_origins = AllowedOrigins::some_exact(&["http://localhost:3000"]);

    // You can also deserialize this
    let cors = rocket_cors::CorsOptions {
        allowed_origins,
        allowed_methods: vec![Method::Get].into_iter().map(From::from).collect(),
        allowed_headers: AllowedHeaders::some(&["Authorization", "Accept"]),
        allow_credentials: true,
        ..Default::default()
    }
    .to_cors()?;
    rocket::ignite()
        .attach(cors)
        .mount("/api", routes![state])
        .launch();
    Ok(())
}
