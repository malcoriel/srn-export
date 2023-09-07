use serde_derive::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::fmt::{Debug, Display, Formatter, Result};
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(Clone, Eq, Hash, Copy)]
pub struct Vec2i32 {
    pub x: i32,
    pub y: i32,
}

impl Vec2i32 {
    pub fn as_key(&self) -> String {
        String::from(format!("{}/{}", self.x, self.y))
    }
}

impl Debug for Vec2i32 {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(f, "{}/{}", self.x, self.y)
    }
}

impl Display for Vec2i32 {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(f, "{}/{}", self.x, self.y)
    }
}

impl PartialEq for Vec2i32 {
    fn eq(&self, other: &Self) -> bool {
        return self.x == other.x && self.y == other.y;
    }
}

impl Vec2i32 {
    pub fn add(&self, other: &Vec2i32) -> Vec2i32 {
        Vec2i32 {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }

    pub fn subtract(&self, other: &Vec2i32) -> Vec2i32 {
        Vec2i32 {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }
}

#[derive(Default, Clone, Copy, Deserialize, Serialize, TypescriptDefinition, TypeScriptify)]
pub struct Vec2f64 {
    pub x: f64,
    pub y: f64,
}

pub enum Precision {
    P0,
    P2,
    P8,
    P10,
    P12,
    P14,
}

// due to some serialization-deserialization between rust and js, it's possible to get a precision mismatch just
// by transferring data through the wasm boundary. I'm trying to deal with it by reducing f64 precision
// The mismatch can happen around last significant digit, so I'm just cutting stuff short here
pub fn reduce_precision(num: f64) -> f64 {
    let twelve_digits = 1000000000000.0;
    f64::trunc(num * twelve_digits) / twelve_digits
}

impl Vec2f64 {
    pub fn as_key(&self, precision: Precision) -> String {
        match precision {
            Precision::P0 => String::from(format!("{:.0}/{:.0}", self.x, self.y)),
            Precision::P2 => String::from(format!("{:.2}/{:.2}", self.x, self.y)),
            Precision::P8 => String::from(format!("{:.8}/{:.8}", self.x, self.y)),
            Precision::P10 => String::from(format!("{:.10}/{:.10}", self.x, self.y)),
            Precision::P12 => String::from(format!("{:.12}/{:.12}", self.x, self.y)),
            Precision::P14 => String::from(format!("{:.14}/{:.14}", self.x, self.y)),
        }
    }

    pub fn zero() -> Vec2f64 {
        Vec2f64 { x: 0.0, y: 0.0 }
    }

    pub fn reduce_precision(&mut self) {
        self.x = reduce_precision(self.x);
        self.y = reduce_precision(self.y);
    }
}

impl Debug for Vec2f64 {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(f, "{:.8}/{:.8}", self.x, self.y)
    }
}

pub const EPS: f64 = 1e-8f64;
impl Display for Vec2f64 {
    fn fmt(&self, f: &mut Formatter<'_>) -> Result {
        write!(f, "{:.2}/{:.2}", self.x, self.y)
    }
}

impl PartialEq for Vec2f64 {
    fn eq(&self, other: &Self) -> bool {
        return (self.x - other.x).abs() <= EPS && (self.y - other.y).abs() <= EPS;
    }
}

impl Vec2f64 {
    pub fn add(&self, other: &Vec2f64) -> Vec2f64 {
        Vec2f64 {
            x: self.x + other.x,
            y: self.y + other.y,
        }
    }

    pub fn subtract(&self, other: &Vec2f64) -> Vec2f64 {
        Vec2f64 {
            x: self.x - other.x,
            y: self.y - other.y,
        }
    }

    pub fn mul(&self, other: &Vec2f64) -> Vec2f64 {
        Vec2f64 {
            x: self.x * other.x,
            y: self.y * other.y,
        }
    }

    pub fn scalar_mul(&self, coeff: f64) -> Vec2f64 {
        Vec2f64 {
            x: self.x * coeff,
            y: self.y * coeff,
        }
    }

    pub fn normalize(&self) -> Option<Vec2f64> {
        let len = self.euclidean_len();
        return if len != 0.0 {
            Some(Vec2f64 {
                x: self.x / len,
                y: self.y / len,
            })
        } else {
            None
        };
    }

    pub fn euclidean_distance(&self, other: &Vec2f64) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn euclidean_len(&self) -> f64 {
        return self.euclidean_distance(&Vec2f64 { x: 0.0, y: 0.0 });
    }

    pub fn are_parallel(&self, b: &Vec2f64) -> bool {
        return (self.x * b.y - self.y * b.x).abs() < EPS;
    }

    pub fn scalar_multiply(&self, b: &Vec2f64) -> f64 {
        self.x * b.x + self.y * b.y
    }

    pub fn len(&self) -> f64 {
        return self.euclidean_len();
    }

    // Does not distinguish angle 'direction' - will always give from 0 to PI
    pub fn angle_rad(&self, b: &Vec2f64) -> f64 {
        let mut acos_arg = self.scalar_multiply(b) / self.euclidean_len() / b.euclidean_len();
        if acos_arg.is_infinite() || acos_arg.is_nan() {
            acos_arg = 0.0;
        }
        if acos_arg > 1.0 {
            acos_arg = 1.0;
        } else if acos_arg < -1.0 {
            acos_arg = -1.0;
        }
        let val = (acos_arg).acos();
        if val.is_infinite() || val.is_nan() {
            return if acos_arg == 1.0 {
                0.0
            } else if acos_arg == -1.0 {
                PI
            } else {
                0.0
            };
        }
        val
    }

    // Returns angle from -PI to PI, positive values -> counterclockwise assuming Y is up (math coordinates)
    pub fn angle_rad_signed(&self, b: &Vec2f64) -> f64 {
        let angle_abs = self.angle_rad(b);
        let cross_product = self.x * b.y + self.y * b.x;
        let sin = cross_product / self.euclidean_len() / b.euclidean_len();
        return if sin < 0.0 { -angle_abs } else { angle_abs };
    }

    // Returns angle from 0 to 2PI, positive values -> counterclockwise assuming Y is up (math coordinates), 1.5 PI -> looks down
    pub fn angle_rad_circular_rotation(&self, b: &Vec2f64) -> f64 {
        let angle = self.angle_rad_signed(b);
        if angle < 0.0 {
            angle + 2.0 * PI
        } else {
            angle
        }
    }

    pub fn angle_deg(&self, b: &Vec2f64) -> f64 {
        rad_to_deg(self.angle_rad(b))
    }

    // x goes right, y goes down, but angle goes from +x to -y
    pub fn rotate(&self, angle: f64) -> Vec2f64 {
        let x = self.x;
        let y = self.y;
        let x_new = ((x) * angle.cos()) - ((-y) * angle.sin());
        let cmp1 = (-y) * angle.cos();
        let cmp2 = (x) * angle.sin();
        let y_new = cmp1 - cmp2;
        return Vec2f64 { x: x_new, y: y_new };
    }
}
pub fn approx_eq(a: f64, b: f64) -> bool {
    return (a - b).abs() < EPS;
}
pub fn rad_to_deg(r: f64) -> f64 {
    r * 180f64 / PI
}
pub fn deg_to_rad(d: f64) -> f64 {
    d / 180f64 * PI
}

pub trait AsVec2f64 {
    fn as_vec(&self) -> Vec2f64;
}
