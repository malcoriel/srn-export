use crate::avro::SchemaId::Test_V1;
use apache_avro::{to_avro_datum, Codec, Schema, Writer};
use include_dir::{include_dir, Dir};
use lazy_static::lazy_static;
use mut_static::MutStatic;
use serde::de::DeserializeOwned;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
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
    let schemas = Schema::parse_list(
        SCHEMAS_DIR
            .files()
            .map(|file| {
                std::str::from_utf8(file.contents())
                    .expect(format!("could not parse bytes from file {:?}", file.path()).as_str())
            })
            .collect::<Vec<_>>()
            .as_slice(),
    )
    .expect("could not parse schema list");
    for schema in schemas {
        map.push(get_schema_id(&schema), schema);
    }
    return map;
}

#[derive(Serialize, Deserialize, Debug)]
struct SchemaDocMeta {
    pub version: Option<u32>,
}

fn get_schema_id(sc: &Schema) -> SchemaId {
    let default_meta = SchemaDocMeta { version: None };
    let doc_as_meta: SchemaDocMeta =
        serde_json::from_str(get_doc(sc).as_str()).unwrap_or(default_meta);
    let version = doc_as_meta
        .version
        .map_or("".to_string(), |v| format!("_V{}", v));
    let str_id = format!("{}{}", get_name(sc), version);
    return SchemaId::from_str(str_id.as_str())
        .map_err(|e| {
            warn!(format!("failed to parse {}", str_id));
            e
        })
        .unwrap();
}

fn get_name(sc: &Schema) -> String {
    match sc {
        Schema::Record { name, .. } => name.to_string(),
        _ => panic!("Cannot get name for non-record schema"),
    }
}

fn get_doc(sc: &Schema) -> String {
    match sc {
        Schema::Record { doc, .. } => doc.as_ref().map_or("".to_string(), |d| d.to_string()),
        _ => panic!("Cannot get doc for non-record schema"),
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
