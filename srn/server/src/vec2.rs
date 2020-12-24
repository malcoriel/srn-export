use std::f64::consts::PI;
use std::fmt::{Debug, Display, Formatter, Result};

pub trait IVec2<T> {
    fn x(self) -> T;
    fn y(self) -> T;
}

pub struct Vec2<T> {
    pub x: T,
    pub y: T,
}

impl<T> IVec2<T> for Vec2<T> {
    fn x(self) -> T {
        self.x
    }

    fn y(self) -> T {
        self.y
    }
}

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

#[derive(Clone, Copy)]
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
}

pub fn approx_eq(a: f64, b: f64) -> bool {
    return (a - b).abs() < EPS;
}

pub fn are_parallel(a: Vec2f64, b: Vec2f64) -> bool {
    return (a.x * b.y - a.y * b.x).abs() < EPS;
}

pub fn scalar_multiply(a: Vec2f64, b: Vec2f64) -> f64 {
    a.x * b.x + a.y * b.y
}

pub fn len(a: Vec2f64) -> f64 {
    (a.x * a.x + a.y * a.y).sqrt()
}

pub fn angle_rad(a: Vec2f64, b: Vec2f64) -> f64 {
    (scalar_multiply(a, b) / len(a) / len(b)).acos()
}

pub fn rad_to_deg(r: f64) -> f64 {
    r * 180f64 / PI
}
pub fn deg_to_rad(d: f64) -> f64 {
    d / 180f64 * PI
}

pub fn angle_deg(a: Vec2f64, b: Vec2f64) -> f64 {
    rad_to_deg(angle_rad(a, b))
}
