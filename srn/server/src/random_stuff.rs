use rand::prelude::*;
use crate::world::Rarity;

pub const STAR_NAMES: [&str; 32] = [
    "Ithoins",
    "Ovlet",
    "Vreek",
    "Grelt",
    "Ruad",
    "Voatsalt",
    "Sluef",
    "Mais",
    "Gux",
    "Ujob",
    "Priacsip",
    "Aweunduth",
    "Sraumsors",
    "Zrivrans",
    "Ochap",
    "Bu",
    "Thi",
    "Ikleoy",
    "Zain",
    "Sraldeey",
    "Vlufil",
    "Ma",
    "Vloap",
    "Ibub",
    "Heiy",
    "Bloosh",
    "Hozreir",
    "Bonleels",
    "Ciufel",
    "Xoazers",
    "Clays",
    "Srea",
];

pub const COLORS: [&str; 32] = [
    "#0D57AC", "#AE213D", "#DE4C0A", "#05680D", "#01A6A0", "#9D91A1", "#AA6478", "#4D56A5",
    "#382C4F", "#AC54AD", "#8D948D", "#A0B472", "#C7B4A6", "#1D334A", "#5BBAA9", "#008FA9",
    "#ADBEA3", "#F5B0A1", "#A1A70B", "#025669", "#AE2460", "#955802", "#9C46B8", "#DE019B",
    "#DC890C", "#F68923", "#F4A261", "#E76F51", "#849324", "#FD151B", "#D8A47F", "#EF8354",
];

pub const STAR_COLORS: [(&str, &str); 8] = [
    ("#6C0900", "#6C0900"), // dark red
    ("#9D2302", "#9D2302"), // darkish red
    ("#C64F10", "#C64F10"), // dark orange
    ("#ED8B34", "#ED8B34"), // orange,
    ("#FFD384", "#FFD384"), // pale yellow,
    ("#FDFFD3", "#FDFFD3"), // yellow-white,
    ("#E3FFFA", "#E3FFFA"), // blue-white,
    ("#80B7FF", "#80B7FF"), // full-blue
];

pub const PLANET_NAMES: [&str; 32] = [
    "Scarol", "Dailla", "Tapella", "Agland", "Ceonine", "Depes", "Mazsea", "Brova", "Legcan",
    "Tolopa", "Intum", "Bettose", "Harutlis", "Intfiner", "Arudros", "Whimox", "Wonuria",
    "Wimnicus", "Grenfar", "Lenis", "Kerenna", "Furtate", "Vhilnea", "Sangre", "Polyku", "Mois",
    "Takcon", "Dekma", "Khalassa", "Taruk", "Synocon", "Valyti",
];

pub const SAT_NAMES: [&str; 32] = [
    "Cox K-054",
    "Culpeper L-1",
    "Hahn Q-3",
    "Lovelace X-11",
    "Maa F-1",
    "Shuixing A-5",
    "Dünya Z-49",
    "Päike RV-65",
    "Nakaya V-2",
    "Celsius B-01",
    "Konrad KUY-4",
    "Qurra WI-39",
    "Uranus K-551",
    "Prhasbadi S-9",
    "Lune J-2",
    "Wenus GI-843",
    "Neptunus O-97",
    "Leo S-7",
    "Angel W-1",
    "Jean U-52",
    "Shintaro",
    "Jupiters UY-1",
    "Ierde O-84",
    "Vênus W-3",
    "Hirase N-5",
    "de Coulomb BO-9",
    "Einstein A-87",
    "Mercur P-2",
    "Guru LE-1",
    "Utarid A-93",
    "Sonn E-2",
    "Hëna A-9",
];

pub const BOT_NAMES: [&str; 32] = [
    "Brobot", "Tin", "Gigabit", "Scrap", "Eyax", "Ohtron", "Ash", "Cyl", "Clank", "Sterling",
    "Efttron", "Ibud", "Buttons", "Plex", "Scythe", "Oqotron", "Usp", "Rust", "Spudnik", "Brobot",
    "Micro", "Izp", "ipsroid", "Bult", "Otis", "Earl", "Spencer", "Ifen", "Af", "Jin", "Plexi",
    "Aqroid",
];

pub const CHARACTER_NAMES: [&str; 32] = [
    "Moad Velazquez",
    "Kian-James Acevedo",
    "Brizzy Warspeeder",
    "Czia Yonson",
    "Rehaan Jaise Dixon",
    "Admiral Ines Chaney",
    "Oluwatoni Melendez",
    "James-Paul Ochoa",
    "Korey Jefferson",
    "Dennis Ponson",
    "Christian Nedex",
    "Dr Ton Broan",
    "Vake Walkatus",
    "Derick Robinson",
    "Wzee Frazier",
    "Kaylum Crushfadden",
    "Varol Maradder",
    "Mason Davallister",
    "Hoshi Park",
    "Athol Komm",
    "Conar Graham",
    "Han Acevedo",
    "High Admiral Jago Yates",
    "Quabeth Fomm",
    "Kaeden Morris",
    "Admiral Yerry Solson",
    "Madaki Morales",
    "Bhaaldeen Kedrick Spintus",
    "Jonson Edwards",
    "Krark Cummings",
    "Aaron Embscraper",
    "Lzee Hilly",
];

pub fn rand_32(rng: &mut SmallRng) -> usize {
    return rng.gen_range(0, 32);
}

pub fn rand_8(rng: &mut SmallRng) -> usize {
    return rng.gen_range(0, 8);
}

pub fn gen_star_name(rng: &mut SmallRng) -> &'static str {
    STAR_NAMES[rand_32(rng)]
}

pub fn gen_planet_name(rng: &mut SmallRng) -> &'static str {
    PLANET_NAMES[rand_32(rng)]
}

pub fn gen_random_character_name() -> &'static str {
    let mut rng = thread_rng();
    let mut prng = SmallRng::seed_from_u64(rng.next_u64());
    CHARACTER_NAMES[rand_32(&mut prng)]
}

pub fn gen_sat_name(rng: &mut SmallRng) -> &'static str {
    SAT_NAMES[rand_32(rng)]
}

pub fn gen_color(rng: &mut SmallRng) -> &'static str {
    COLORS[rand_32(rng)]
}
pub fn gen_star_color(rng: &mut SmallRng) -> (&'static str, &'static str) {
    STAR_COLORS[rand_8(rng)]
}

pub fn gen_bot_name(rng: &mut SmallRng) -> String {
    format!("{} (bot)", BOT_NAMES[rand_32(rng)].to_string())
}

pub fn gen_planet_count(rng: &mut SmallRng) -> u32 {
    return rng.gen_range(5, 8);
}

pub fn gen_asteroid_radius(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(0.2, 0.8);
}

pub fn gen_asteroid_shift(rng: &mut SmallRng) -> (f64, f64) {
    let min = 3.0;
    let max = 5.0;
    return (rng.gen_range(min, max), rng.gen_range(min, max));
}

pub fn gen_sat_count(planet_radius: f64, rng: &mut SmallRng) -> u32 {
    if planet_radius < 10.0 {
        return rng.gen_range(0, 2);
    }
    if planet_radius < 15.0 {
        return rng.gen_range(1, 3);
    }
    return rng.gen_range(2, 5);
}

pub fn gen_star_radius(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(20.0, 80.0);
}

pub fn gen_planet_gap(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(60.0, 80.0);
}

pub fn gen_planet_orbit_speed(rng: &mut SmallRng) -> f64 {
    let dir = if rng.gen_bool(0.5) { -1.0 } else { 1.0 };
    return rng.gen_range(5.0, 55.0) / 750.0 * dir;
}

pub fn gen_sat_orbit_speed(rng: &mut SmallRng) -> f64 {
    let dir = if rng.gen_bool(0.5) { -1.0 } else { 1.0 };
    return rng.gen_range(20.0, 30.0) / 100.0 * dir;
}

pub fn gen_planet_radius(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(8.0, 20.0);
}

pub fn gen_sat_radius(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(2.0, 3.0);
}

pub fn gen_sat_gap(rng: &mut SmallRng) -> f64 {
    return rng.gen_range(8.0, 12.0);
}

pub fn gen_random_photo_id(rng: &mut SmallRng) -> i32 {
    return rng.gen_range(1, 10);
}

// radius, value, color
pub fn gen_mineral_props(rng: &mut SmallRng) -> (f64, i32, String, Rarity) {
    let chance = rng.gen_range(0.0, 1.0);
    return if chance < 0.5 {
        (2.0, 100, "#b87333".to_string(), Rarity::Common)
    } else if chance < 0.85 {
        (1.5, 200, "#c0c0c0".to_string(), Rarity::Uncommon)
    } else {
        (1.0, 300, "#ffd700".to_string(), Rarity::Rare)
    };
}
