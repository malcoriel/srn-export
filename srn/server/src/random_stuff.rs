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
    "#0D57AC", "#AE213D", "#DE4C0A", "#05680D", "#01A6A0", "#9D91A1", "#AA6478", "#4D56A5",
    "#382CAE", "#AC54AD", "#8D948D", "#A0B472", "#C7B4A6", "#1D334A", "#5BBAA9", "#008FA9",
    "#ADBEA3", "#F5B0A1", "#A1A70B", "#025669", "#AE2460", "#955802", "#9c46b8", "#de019b",
    "#dc890c", "#f68923", "#f4a261", "#e76f51", "#849324", "#fd151b", "#d8a47f", "#ef8354",
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

const BOT_NAMES: [&str; 32] = [
    "Brobot", "Tin", "Gigabit", "Scrap", "Eyax", "Ohtron", "Ash", "Cyl", "Clank", "Sterling",
    "Efttron", "Ibud", "Buttons", "Plex", "Scythe", "Oqotron", "Usp", "Rust", "Spudnik", "Brobot",
    "Micro", "Izp", "ipsroid", "Bult", "Otis", "Earl", "Spencer", "Ifen", "Af", "Jin", "Plexi",
    "Aqroid",
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

pub fn gen_bot_name() -> String {
    format!("{} (bot)", BOT_NAMES[rand_32()].to_string())
}

pub fn gen_planet_count() -> u32 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(5, 8);
}

pub fn gen_sat_count(planet_radius: f64) -> u32 {
    let mut rng: ThreadRng = rand::thread_rng();
    if planet_radius < 10.0 {
        return rng.gen_range(0, 2);
    }
    if planet_radius < 15.0 {
        return rng.gen_range(1, 3);
    }
    return rng.gen_range(2, 5);
}

pub fn gen_star_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(40.0, 60.0);
}

pub fn gen_planet_gap() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(60.0, 80.0);
}

pub fn gen_planet_orbit_speed() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(5.0, 55.0) / 750.0;
}

pub fn gen_sat_orbit_speed() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(20.0, 30.0) / 100.0;
}

pub fn gen_planet_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(8.0, 20.0);
}

pub fn gen_sat_radius() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(2.0, 3.0);
}

pub fn gen_sat_gap() -> f64 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(8.0, 12.0);
}

pub fn gen_random_photo_id() -> i32 {
    let mut rng: ThreadRng = rand::thread_rng();
    return rng.gen_range(1, 10);
}
