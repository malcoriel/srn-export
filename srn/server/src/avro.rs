use crate::avro::SchemaId::Test_V1;
use apache_avro::{to_avro_datum, Codec, Schema, Writer};
use include_dir::{include_dir, Dir};
use lazy_static::lazy_static;
use mut_static::MutStatic;
use serde::de::DeserializeOwned;
use serde_derive::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::iter::FromIterator;
use std::path::Path;
use std::str::FromStr;
use strum_macros::EnumString;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(
    Serialize,
    Deserialize,
    Debug,
    Clone,
    PartialEq,
    Eq,
    TypescriptDefinition,
    TypeScriptify,
    Hash,
    EnumString,
)]
pub enum SchemaId {
    Test_V1,
    State_V1,
    Vec2f64_V1,
    SpatialProps_V1,
}

pub struct AvroSchemaMap {
    pub index: HashMap<SchemaId, Schema>,
    pub elems: Vec<Schema>,
}

impl AvroSchemaMap {
    pub fn push(&mut self, id: SchemaId, schema: Schema) {
        self.elems.push(schema.clone());
        self.index.insert(id, schema);
    }
}

pub const AVRO_CODEC: Codec = Codec::Null;

static SCHEMAS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../server/resources/avro_schemas");

pub fn gen_avro_schemas() -> AvroSchemaMap {
    let mut map = AvroSchemaMap {
        index: HashMap::new(),
        elems: vec![],
    };
    let raw_schema = r#"
    {
        "type": "record",
        "name": "test",
        "fields": [
            {"name": "a", "type": "long", "default": 42},
            {"name": "b", "type": "string"},
            {"name": "c", "type": "long"}
        ]
    }
    "#;
    let schema = Schema::parse_str(raw_schema).unwrap();
    // of course, you can retrieve a file by its full path
    map.push(SchemaId::Test_V1, schema);
    let blacklist: HashSet<String> = HashSet::from_iter(vec![]);
    // let schemas =
    //     Schema::parse_list(
    //         SCHEMAS_DIR
    //             .files()
    //             .filter_map(|file| {
    //                 if blacklist
    //                     .iter()
    //                     .any(|black_item| file.path().to_string_lossy().ends_with(black_item))
    //                 {
    //                     return None;
    //                 }
    //                 Some(std::str::from_utf8(file.contents()).expect(
    //                     format!("could not parse bytes from file {:?}", file.path()).as_str(),
    //                 ))
    //             })
    //             .collect::<Vec<_>>()
    //             .as_slice(),
    //     )
    //     .expect("could not parse schema list");
    // for schema in schemas {
    //     let id = get_schema_id(&schema);
    //     if let Some(id) = id {
    //         log!(format!("Pushing schema {id:?}"));
    //         map.push(id, schema);
    //     }
    // }
    return map;
}

#[derive(Serialize, Deserialize, Debug)]
struct SchemaDocMeta {
    pub version: Option<u32>,
}

fn get_schema_id(sc: &Schema) -> Option<SchemaId> {
    let name = get_name(sc);
    if name.is_none() {
        warn!(format!("No name for {:?}", sc));
        return None;
    }
    let name = name.unwrap();
    let version = SchemaDocMeta { version: None }
        .version
        .map_or("".to_string(), |v| format!("_V{}", v));
    let str_id = format!("{}{}", name, version);
    log!(format!("checking {str_id}"));
    SchemaId::from_str(str_id.as_str())
        .map_err(|e| {
            warn!(format!(
                "failed to identify schema id for schema {}",
                str_id
            ));
            e
        })
        .ok()
}

fn get_name(sc: &Schema) -> Option<String> {
    match sc {
        Schema::Enum { name, .. } => Some(name.to_string()),
        Schema::Ref { name, .. } => Some(name.to_string()),
        Schema::Record { name, .. } => Some(name.to_string()),
        _ => None,
    }
}

fn get_doc(sc: &Schema) -> Option<String> {
    match sc {
        Schema::Record { doc, .. } => Some(doc.as_ref().map_or("".to_string(), |d| d.to_string())),
        _ => None,
    }
}

lazy_static! {
    pub static ref AVRO_SCHEMAS: AvroSchemaMap = { gen_avro_schemas() };
}

pub fn avro_serialize<T: serde::Serialize>(schema: &Schema, test: T) -> Vec<u8> {
    to_avro_datum(schema, apache_avro::to_value(test).unwrap()).unwrap()
}

pub fn avro_deserialize<T: DeserializeOwned>(mut arg: &mut Vec<u8>, schema: &Schema) -> T {
    apache_avro::from_value::<T>(
        &apache_avro::from_avro_datum(schema, &mut arg.as_slice(), None).unwrap(),
    )
    .unwrap()
}
