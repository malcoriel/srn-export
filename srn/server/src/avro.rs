use crate::avro::SchemaId::TestV1;
use apache_avro::{to_avro_datum, Codec, Schema, Writer};
use lazy_static::lazy_static;
use mut_static::MutStatic;
use serde::de::DeserializeOwned;
use serde_derive::{Deserialize, Serialize};
use std::collections::HashMap;
use typescript_definitions::{TypeScriptify, TypescriptDefinition};
use wasm_bindgen::prelude::*;

#[derive(
    Serialize, Deserialize, Debug, Clone, PartialEq, Eq, TypescriptDefinition, TypeScriptify, Hash,
)]
pub enum SchemaId {
    TestV1,
    StateV1,
}
// for some reason, serde_derive cannot derive Deserialize here
#[derive(Serialize, Debug, Clone, TypescriptDefinition, TypeScriptify)]
pub struct SchemaContainer {
    pub schema: Schema,
    pub header_len: usize,
}

pub type AvroSchemaMap = HashMap<SchemaId, SchemaContainer>;

pub const AVRO_CODEC: Codec = Codec::Null;

pub fn gen_avro_schemas() -> AvroSchemaMap {
    let mut res = HashMap::new();
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
    let header_len = gen_same_header_as_avro(&schema, AVRO_CODEC).unwrap().len();
    res.insert(SchemaId::TestV1, SchemaContainer { schema, header_len });
    return res;
}

lazy_static! {
    pub static ref AVRO_SCHEMAS: MutStatic<AvroSchemaMap> = { MutStatic::from(gen_avro_schemas()) };
}

// due to apache_avro having an ugly implementation without schema-less support, we have to jump
// through hoops to calculate the header length that has to be cut off from the beginning of the writer result
const AVRO_OBJECT_HEADER: &[u8] = b"Obj\x01";
pub fn gen_same_header_as_avro(
    schema: &Schema,
    codec: apache_avro::Codec,
) -> Result<Vec<u8>, apache_avro::Error> {
    let schema_bytes = serde_json::to_string(schema)
        .map_err(apache_avro::Error::ConvertJsonToString)?
        .into_bytes();

    let mut metadata = HashMap::with_capacity(2);
    metadata.insert(
        "avro.schema",
        apache_avro::types::Value::Bytes(schema_bytes),
    );
    metadata.insert("avro.codec", codec.into());

    // metadata will break the calculation, so we must not support it
    // for (k, v) in &self.user_metadata {
    //     metadata.insert(k.as_str(), v.clone());
    // }

    let meta_value = apache_avro::types::Value::Map(
        metadata
            .into_iter()
            .map(|(key, value)| (key.into(), value.into()))
            .collect(),
    );
    let mut header = Vec::new();
    header.extend_from_slice(AVRO_OBJECT_HEADER);
    let tmp = to_avro_datum(&Schema::Map(Box::new(Schema::Bytes)), meta_value).unwrap();
    header.extend_from_slice(&tmp);
    let marker = Vec::<u8>::with_capacity(16);
    header.extend_from_slice(&marker);

    Ok(header)
}

pub fn serialize_schemaless<S: serde::ser::Serialize>(
    schema: &Schema,
    header_len: usize,
    value: S,
) -> Vec<u8> {
    let mut writer = Writer::with_codec(&schema, Vec::new(), AVRO_CODEC);
    writer.append_ser(value).unwrap();
    let encoded = writer.into_inner().unwrap();
    let initial_len = encoded.len();
    let prefix_len = 18;
    let suffix_len = 16;
    let true_size = initial_len - header_len - prefix_len - suffix_len;
    let no_header = encoded
        .into_iter()
        .skip(header_len + prefix_len)
        .take(true_size)
        .collect::<Vec<u8>>();
    return no_header;
}

pub fn avro_serialize<T: serde::Serialize>(schema_cont: &SchemaContainer, test: T) -> Vec<u8> {
    to_avro_datum(&schema_cont.schema, apache_avro::to_value(test).unwrap()).unwrap()
}

pub fn avro_deserialize<T: DeserializeOwned>(
    mut arg: &mut Vec<u8>,
    schema_cont: &SchemaContainer,
) -> T {
    apache_avro::from_value::<T>(
        &apache_avro::from_avro_datum(&schema_cont.schema, &mut arg.as_slice(), None).unwrap(),
    )
    .unwrap()
}
