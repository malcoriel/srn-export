use std::fs;
use std::ops::Deref;
use serde::de::DeserializeOwned;
use serde::Deserialize;

pub fn get_jsons_from_res_dir(dir: &str) -> Vec<String> {
    let entries = fs::read_dir(format!("resources/{}",dir)).unwrap().filter_map(|e| {
        let e = e.ok().unwrap();
        let file_name = (*e.path().clone().file_prefix().unwrap()).to_string_lossy().to_string();
        let file_ext = e.path().extension().map(|s| s.to_string_lossy().to_string());
        if file_ext.map_or(false, |ext| ext == "json")  {
            Some(file_name)
        }
        else {
            None
        }
    }).collect();
    entries
}

pub fn read_json<T: DeserializeOwned>(full_path: String) -> T {
    let str = fs::read_to_string(full_path.clone()).expect(format!("couldn't get {}", full_path).as_str()).to_string();
    serde_json::from_str(str.as_str()).unwrap()
}

pub fn read_json_from_res_dir<T: DeserializeOwned>(dir: &str, filename: String) -> T {
    let mut corrected_name = filename;
    if !corrected_name.ends_with(".json") {
        corrected_name += ".json";
    }
    read_json(format!("resources/{}/{}", dir, corrected_name))
}
