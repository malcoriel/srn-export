use serde::de::DeserializeOwned;
use serde::Deserialize;
use std::fs;
use std::ops::Deref;

pub fn get_jsons_from_res_dir(dir: &str) -> Vec<String> {
    let entries = fs::read_dir(format!("resources/{}", dir))
        .unwrap()
        .filter_map(|e| {
            let e = e.ok().unwrap();
            let file_name = (*e.path().clone().file_prefix().unwrap())
                .to_string_lossy()
                .to_string();
            let file_ext = e
                .path()
                .extension()
                .map(|s| s.to_string_lossy().to_string());
            if file_ext.map_or(false, |ext| ext == "json") {
                Some(file_name)
            } else {
                None
            }
        })
        .collect();
    entries
}

#[derive(Debug)]
pub enum ResourceReadError {
    FailedToRead {
        path: String,
    },
    FailedToParse {
        path: String,
        e: serde_json::error::Error,
    },
}

pub fn read_json<T: DeserializeOwned>(path: String) -> Result<T, ResourceReadError> {
    let str = fs::read_to_string(path.clone())
        .map_err(|_| ResourceReadError::FailedToRead { path: path.clone() })?;
    let res = serde_json::from_str::<T>(str.as_str())
        .map_err(|e| ResourceReadError::FailedToParse { e, path })?;
    Ok(res)
}

pub fn read_json_from_res_dir<T: DeserializeOwned>(
    dir: &str,
    filename: &String,
) -> Result<T, ResourceReadError> {
    let mut corrected_name = filename.clone();
    if !corrected_name.ends_with(".json") {
        corrected_name += ".json";
    }
    read_json(format!("resources/{}/{}", dir, corrected_name))
}
