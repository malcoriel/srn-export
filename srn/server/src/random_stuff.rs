use rand::prelude::*;

const STAR_NAMES: [&str; 32] = [
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

const COLORS: [&str; 32] = [
    "#2D572C", "#1E213D", "#DE4C8A", "#3E3B32", "#35682D", "#316650", "#9D9101", "#E1CC4F",
    "#2A6478", "#705335", "#C51D34", "#4D5645", "#382C1E", "#1C542D", "#8D948D", "#4E3B31",
    "#474B4E", "#57A639", "#A03472", "#C7B446", "#1D334A", "#5B3A29", "#008F39", "#1D1E33",
    "#F54021", "#924E7D", "#D7D7D7", "#231A24", "#31372B", "#D7D7D7", "#025669", "#1E2460",
];

const PLANET_NAMES: [&str; 32] = [
    "Scarol", "Dailla", "Tapella", "Agland", "Ceonine", "Depes", "Mazsea", "Brova", "Legcan",
    "Tolopa", "Intum", "Bettose", "Harutlis", "Intfiner", "Arudros", "Whimox", "Wonuria",
    "Wimnicus", "Grenfar", "Lenis", "Kerenna", "Furtate", "Vhilnea", "Sangre", "Polyku", "Mois",
    "Takcon", "Dekma", "Khalassa", "Taruk", "Synocon", "Valyti",
];

const SAT_NAMES: [&str; 32] = [
    "Cox K-054",
    "Culpeper L-1",
    "Hahn",
    "Lovelace X-11",
    "Maa",
    "Shuixing",
    "Dünya Z-49",
    "Päike RV-65",
    "Nakaya V-2",
    "Celsius B-0",
    "Konrad KUY-4",
    "Qurra WI-39",
    "Uranus K-551",
    "Prhasbadi S-9",
    "Lune",
    "Wenus GI-843",
    "Neptunus O-97",
    "Leo",
    "Angel",
    "Jean U-5",
    "Shintaro",
    "Jupiters UY-1",
    "Ierde O-84",
    "Vênus W-3",
    "Hirase",
    "de Coulomb BO-9",
    "Einstein A-87",
    "Mercur",
    "Guru LE-1",
    "Utarid A-9",
    "Sonn",
    "Hëna",
];

pub fn rand_32() -> usize {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(0, 31);
}

pub fn gen_star_name() -> &'static str {
    STAR_NAMES[rand_32()]
}

pub fn gen_planet_name() -> &'static str {
    PLANET_NAMES[rand_32()]
}

pub fn gen_sat_name() -> &'static str {
    SAT_NAMES[rand_32()]
}

pub fn gen_color() -> &'static str {
    COLORS[rand_32()]
}

pub fn gen_planet_count() -> u32 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(4, 8);
}

pub fn gen_sat_count(planet_radius: f64) -> u32 {
    let mut rng: ThreadRng = rand::thread_rng();
    if planet_radius < 15.0 {
        return rng.gen_range(0, 2);
    }
    if planet_radius < 20.0 {
        return rng.gen_range(1, 4);
    }
    return rng.gen_range(3, 7);
}

pub fn gen_star_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(40.0, 60.0);
}

pub fn gen_planet_gap() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(60.0, 100.0);
}

pub fn gen_planet_orbit_speed() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(5.0, 55.0) / 500.0;
}

pub fn gen_sat_orbit_speed() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(5.0, 55.0) / 250.0;
}

pub fn gen_planet_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(10.0, 25.0);
}

pub fn gen_sat_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(2.0, 3.0);
}

pub fn gen_sat_gap() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(8.0, 12.0);
}
