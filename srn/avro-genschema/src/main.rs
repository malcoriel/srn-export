use avro_schema::schema;
use avro_schema::schema::*;
use clap::command;
use serde::ser::SerializeSeq;
use serde::ser::{SerializeMap, SerializeStruct};
use serde::{Serialize, Serializer};
use std::collections::hash_map::Iter;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use syn::visit::Visit;
use syn::{visit, Field, ItemFn, ItemStruct, Type};
use topological_sort::TopologicalSort;
use uuid::*;

#[derive(Debug)]
struct Visitor {
    pub records: HashMap<String, BoxRecord>,
    filter: Option<Vec<String>>,
}

impl Visitor {
    pub fn top_sorted_records(&self) -> Vec<(String, &BoxRecord)> {
        let mut ts = TopologicalSort::<String>::new();
        for (key, value) in self.records.iter() {
            ts.insert(key);
            for dep in value.deps.iter() {
                ts.add_dependency(dep.clone(), key.clone());
            }
        }
        let mut sorted = vec![];
        loop {
            let mut layer = ts.pop_all();
            if layer.len() == 0 {
                break;
            }
            sorted.append(&mut layer)
        }
        eprintln!("sorted len={} {:?}", self.records.len(), sorted);
        sorted
            .into_iter()
            .map(|name| {
                let rec = self.records.get(&name).unwrap();
                (name, rec)
            })
            .collect()
    }
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
pub struct BoxRecord {
    pub deps: Vec<String>,
    pub rec: Record,
}

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
        map.serialize_entry("name", &self.rec.name)?;
        map.serialize_entry("namespace", &self.rec.namespace)?;
        map.serialize_entry(
            "fields",
            &self
                .rec
                .fields
                .clone()
                .into_iter()
                .map(|f| BoxField(f))
                .collect::<Vec<_>>(),
        )?;
        map.serialize_entry("doc", &self.rec.doc)?;
        map.serialize_entry("aliases", &self.rec.aliases)?;
        map.end()
    }
}

impl Visitor {
    fn grab_fields_get_deps(&self, record: &mut Record, node: &ItemStruct) -> Vec<String> {
        let mut unnamed_index = 0;
        let mut deps = vec![];
        for field in node.fields.iter() {
            let (schema, dep_name) = self.map_type(&field.ty);
            if let Some(dep_name) = dep_name {
                deps.push(dep_name);
            }
            record.fields.push(schema::Field {
                name: field.ident.as_ref().map_or_else(
                    || {
                        unnamed_index += 1;
                        unnamed_index.to_string()
                    },
                    |id| id.to_string(),
                ),
                doc: None,
                schema,
                default: None,
                order: None,
                aliases: vec![],
            })
        }
        deps
    }

    fn map_primitive(&self, prim: &str) -> Option<(Schema, Option<String>)> {
        match prim {
            "f64" => Some((Schema::Double, None)),
            _ => None,
        }
    }

    fn map_type(&self, ty: &Type) -> (Schema, Option<String>) {
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
    fn map_reference(&self, reference: &str) -> (Schema, Option<String>) {
        // I am abusing Fixed here because there is no schema-reference ability in avro-schema (Schema::Ref variant)
        // This field will not be a true avro Fixed, but rather 0-size name-reference to another schema
        let ref_name = reference.to_string();
        (
            Schema::Fixed(Fixed {
                name: ref_name.clone(),
                namespace: None,
                doc: None,
                aliases: vec![],
                size: 0,
                logical: None,
            }),
            Some(ref_name),
        )
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

            let deps = self.grab_fields_get_deps(&mut record, node);

            self.records
                .insert(struct_name.clone(), BoxRecord { rec: record, deps });
            eprintln!("Grabbed struct {}", struct_name);
        } else {
            eprintln!("Skipped struct {}", struct_name);
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
                .arg(clap::arg!(--"from" <PATHS>))
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
    let from: Vec<PathBuf> = matches
        .get_one::<String>("from")
        .map(|v| v.clone().split(",").map(|v| PathBuf::from(v)).collect())
        .expect("--from arg is required");
    let filter: Option<Vec<String>> = matches
        .get_one::<String>("filter")
        .map(|v| v.clone().split(",").map(|v| v.to_string()).collect());
    let to = matches
        .get_one::<PathBuf>("to")
        .expect("--to arg is required");

    let mut visitor = Visitor {
        records: HashMap::new(),
        filter: filter.clone(),
    };

    for file in from {
        let src = fs::read_to_string(file.clone()).expect("file not found");
        let file = syn::parse_file(src.as_str())
            .expect(format!("Unable to create AST from file {:?}", file).as_str());
        visitor.visit_file(&file);
    }
    let mut counter = 0;
    for (key, value) in visitor.top_sorted_records() {
        counter += 1;
        let mut file_path = to.clone();
        file_path.push(PathBuf::from(format!("{counter:0>4}-{key}.json")));
        let serialized = serde_json::to_string_pretty(value)
            .expect(format!("could not serialize record named {key}").as_str());
        fs::write(file_path.clone(), serialized)
            .expect(format!("could not write to file {file_path:?}").as_str());
    }
}
