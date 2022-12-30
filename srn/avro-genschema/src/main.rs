use avro_schema::schema;
use avro_schema::schema::*;
use clap::command;
use serde::ser::SerializeSeq;
use serde::ser::{SerializeMap, SerializeStruct};
use serde::{Serialize, Serializer};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{visit, Field, ItemFn, ItemStruct, Type};
use uuid::*;

#[derive(Debug)]
struct Visitor {
    pub records: HashMap<String, BoxRecord>,
    filter: Option<Vec<String>>,
}

pub struct SpatialProps {
    pub foo: i32,
    pub bar: String,
}

pub enum Movement {
    Alpha(i32),
    Beta { baz: f64 },
}

pub struct ObjectProperty {
    pub empty: f32,
}

pub struct PlanetV2 {
    pub id: Uuid,
    pub name: String,
    pub spatial: SpatialProps,
    pub movement: Movement,
    pub anchor_tier: u32,
    pub color: String,
    pub health: Option<ObjectProperty>,
    pub properties: Vec<ObjectProperty>,
    pub properties2: HashMap<String, ObjectProperty>,
}

#[derive(Debug)]
pub struct BoxRecord(Record);

#[derive(Debug)]
pub struct BoxField(schema::Field);

#[derive(Debug)]
pub enum SchemaOrRef {
    Schema(Schema),
    Ref(String),
}

impl Serialize for SchemaOrRef {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            SchemaOrRef::Schema(schema) => schema.serialize(serializer),
            SchemaOrRef::Ref(str) => serializer.serialize_str(str.as_str()),
        }
    }
}
impl Serialize for BoxField {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(5))?;

        let schema_clone = self.0.schema.clone();
        let schema_fixed: SchemaOrRef = match &self.0.schema {
            Schema::Fixed(Fixed { size, name, .. }) => {
                if *size == 0 {
                    SchemaOrRef::Ref(name.clone())
                } else {
                    SchemaOrRef::Schema(schema_clone)
                }
            }
            _ => SchemaOrRef::Schema(schema_clone),
        };
        map.serialize_entry("type", &schema_fixed)?;
        map.serialize_entry("name", &self.0.name)?;
        map.serialize_entry("default", &self.0.default)?;
        map.serialize_entry("doc", &self.0.doc)?;
        map.serialize_entry("aliases", &self.0.aliases)?;
        // order is ignored here
        map.end()
    }
}

impl Serialize for BoxRecord {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(Some(6))?;
        map.serialize_entry("type", "record")?;
        map.serialize_entry("name", &self.0.name)?;
        map.serialize_entry("namespace", &self.0.namespace)?;
        map.serialize_entry(
            "fields",
            &self
                .0
                .fields
                .clone()
                .into_iter()
                .map(|f| BoxField(f))
                .collect::<Vec<_>>(),
        )?;
        map.serialize_entry("doc", &self.0.doc)?;
        map.serialize_entry("aliases", &self.0.aliases)?;
        map.end()
    }
}

impl Visitor {
    fn grab_fields(&self, record: &mut Record, node: &ItemStruct) {
        let mut unnamed_index = 0;
        for field in node.fields.iter() {
            record.fields.push(schema::Field {
                name: field.ident.as_ref().map_or_else(
                    || {
                        unnamed_index += 1;
                        unnamed_index.to_string()
                    },
                    |id| id.to_string(),
                ),
                doc: None,
                schema: self.map_type(&field.ty),
                default: None,
                order: None,
                aliases: vec![],
            })
        }
    }

    fn map_primitive(&self, prim: &str) -> Option<Schema> {
        match prim {
            "f64" => Some(Schema::Double),
            _ => None,
        }
    }

    fn map_type(&self, ty: &Type) -> Schema {
        match ty {
            // Type::Array(_) => {}
            // Type::BareFn(_) => {}
            // Type::Group(_) => {}
            // Type::ImplTrait(_) => {}
            // Type::Infer(_) => {}
            // Type::Macro(_) => {}
            // Type::Never(_) => {}
            // Type::Paren(_) => {}
            Type::Path(tp) => {
                let first_segment_name = tp.path.segments[0].ident.to_string();
                return self
                    .map_primitive(first_segment_name.as_str())
                    .unwrap_or_else(|| self.map_reference(first_segment_name.as_str()));
            }
            // Type::Ptr(_) => {}
            // Type::Reference(_) => {}
            // Type::Slice(_) => {}
            // Type::TraitObject(_) => {}
            // Type::Tuple(_) => {}
            // Type::Verbatim(_) => {}
            // _ => Schema::Null,
            _ => unimplemented!("Unknown type: {ty:?}"),
        }
    }
    fn map_reference(&self, reference: &str) -> Schema {
        // I am abusing Fixed here because there is no schema-reference ability in avro-schema
        // This field will not be a true avro Fixed, but rather 0-size name-reference to another schema
        Schema::Fixed(Fixed {
            name: reference.to_string(),
            namespace: None,
            doc: None,
            aliases: vec![],
            size: 0,
            logical: None,
        })
    }
}

impl<'ast> Visit<'ast> for Visitor {
    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        let struct_name = node.ident.to_string();
        let analyze = if let Some(filter) = &self.filter {
            filter
                .iter()
                .any(|filter| struct_name.contains(filter.as_str()))
        } else {
            true
        };
        if analyze {
            let mut record = Record {
                name: struct_name.clone(),
                namespace: None,
                doc: Some("{\"version\": 1}".to_string()),
                aliases: vec![],
                fields: vec![],
            };

            self.grab_fields(&mut record, node);

            self.records.insert(struct_name.clone(), BoxRecord(record));
        }
        visit::visit_item_struct(self, node);
    }
}

fn main() {
    let cmd = clap::Command::new("avro-genschema")
        .bin_name("avro-genschema")
        .subcommand_required(true)
        .subcommand(
            command!("generate")
                .arg(
                    clap::arg!(--"from" <PATH>)
                        .value_parser(clap::value_parser!(std::path::PathBuf)),
                )
                .arg(clap::arg!(--"filter" <SUBSTR>))
                .arg(
                    clap::arg!(--"to" <PATH>).value_parser(clap::value_parser!(std::path::PathBuf)),
                ),
        );

    let matches = cmd.get_matches();
    let matches = match matches.subcommand() {
        Some(("generate", matches)) => matches,
        _ => unreachable!("clap should ensure we don't get here"),
    };
    let from = matches
        .get_one::<PathBuf>("from")
        .expect("--from arg is required");
    let filter: Option<Vec<String>> = matches
        .get_one::<String>("filter")
        .map(|v| v.clone().split(",").map(|v| v.to_string()).collect());
    let to = matches
        .get_one::<PathBuf>("to")
        .expect("--to arg is required");

    let src = fs::read_to_string(from).expect("file not found");
    let file = syn::parse_file(src.as_str())
        .expect(format!("Unable to create AST from file {:?}", from).as_str());
    let mut visitor = Visitor {
        records: HashMap::new(),
        filter,
    };
    visitor.visit_file(&file);
    for (key, value) in visitor.records.iter() {
        let mut file_path = to.clone();
        file_path.push(PathBuf::from(format!("{key}.json")));
        let serialized = serde_json::to_string_pretty(value)
            .expect(format!("could not serialize record named {key}").as_str());
        fs::write(file_path.clone(), serialized)
            .expect(format!("could not write to file {file_path:?}").as_str());
    }
}
