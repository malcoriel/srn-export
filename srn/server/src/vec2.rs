use serde_derive::{Deserialize, Serialize};
use std::f64::consts::PI;
use std::fmt::{Debug, Display, Formatter, Result};

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

#[derive(Default, Clone, Copy, Deserialize, Serialize)]
pub struct Vec2f64 {
    pub x: f64,
    pub y: f64,
}

pub enum Precision {
    P0,
    P2,
    P8,
}

impl Vec2f64 {
    pub fn as_key(&self, precision: Precision) -> String {
        match precision {
            Precision::P0 => String::from(format!("{:.0}/{:.0}", self.x, self.y)),
            Precision::P2 => String::from(format!("{:.2}/{:.2}", self.x, self.y)),
            Precision::P8 => String::from(format!("{:.8}/{:.8}", self.x, self.y)),
        }
    }

    pub fn zero() -> Vec2f64 {
        Vec2f64 { x: 0.0, y: 0.0 }
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

    pub fn normalize(&self) -> Vec2f64 {
        let len = self.euclidean_len();
        Vec2f64 {
            x: self.x / len,
            y: self.y / len,
        }
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

    pub fn len(a: Vec2f64) -> f64 {
        (a.x * a.x + a.y * a.y).sqrt()
    }

    pub fn angle_rad(&self, b: &Vec2f64) -> f64 {
        let mut acos_arg = self.scalar_multiply(b) / self.euclidean_len() / b.euclidean_len();
        if acos_arg > 1.0 {
            acos_arg = 1.0;
        } else if acos_arg < -1.0 {
            acos_arg = -1.0;
        }
        (acos_arg).acos()
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
