use avro_schema::schema;
use avro_schema::schema::*;
use clap::command;
use serde::ser::SerializeSeq;
use serde::ser::{SerializeMap, SerializeStruct};
use serde::{Serialize, Serializer};
use std::any::Any;
use std::collections::hash_map::Iter;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use syn::token::Union;
use syn::visit::Visit;
use syn::{
    visit, Field, Fields, GenericArgument, ItemEnum, ItemFn, ItemStruct, PathArguments, Type,
    TypePath,
};
use topological_sort::TopologicalSort;

#[derive(Debug)]
struct Visitor {
    pub entities: HashMap<String, BoxEntity>,
    filter: Option<Vec<String>>,
}

impl Visitor {
    fn grab_fields_get_deps_enum_variant(
        &self,
        en_var: &syn::Variant,
        collected_vars: &mut Vec<BoxRecord>,
        into_deps: &mut Vec<String>,
    ) {
        let mut record = BoxRecord {
            deps: vec![],
            name: en_var.ident.to_string(),
            namespace: None,
            doc: Some("{\"version\": 1}".to_string()),
            fields: vec![],
        };
        self.grab_fields_get_deps_any(&mut record.fields, into_deps, &en_var.fields);
        collected_vars.push(record)
    }

    pub fn top_sorted_records(&self) -> Vec<(String, &BoxEntity)> {
        let mut unmapped_types = vec![];
        let mut ts = TopologicalSort::<String>::new();
        for (key, value) in self.entities.iter() {
            ts.insert(key);
            for dep in value.get_deps().iter() {
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
        eprintln!("sorted len={} {:?}", self.entities.len(), sorted);
        let res = sorted
            .into_iter()
            .filter_map(|name| {
                let rec = self.entities.get(&name);
                if rec.is_none() {
                    unmapped_types.push(name.clone());
                }
                rec.map(|rec| (name, rec))
            })
            .collect();
        if unmapped_types.len() > 0 {
            eprintln!("Unmapped types: {:?}", unmapped_types);
        }
        res
    }
}

#[derive(Debug)]
pub struct BoxRecord {
    pub deps: Vec<String>,
    pub name: String,
    pub namespace: Option<String>,
    pub doc: Option<String>,
    pub fields: Vec<BoxField>,
}

#[derive(Debug)]
pub struct BoxEnum {
    pub deps: Vec<String>,
    pub enum_name: String,
    pub enum_variants: Vec<Schema>,
}
#[derive(Debug)]
pub enum BoxEntity {
    Record(BoxRecord),
    Enum(BoxEnum),
}

impl BoxEntity {
    fn get_deps(&self) -> &Vec<String> {
        match self {
            BoxEntity::Record(v) => &v.deps,
            BoxEntity::Enum(v) => &v.deps,
        }
    }
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
        let mut map = serializer.serialize_map(None)?;

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
        if self.0.default.is_some() {
            map.serialize_entry("default", &self.0.default)?;
        }
        if self.0.doc.is_some() {
            map.serialize_entry("doc", &self.0.doc)?;
        }
        if self.0.aliases.len() > 0 {
            map.serialize_entry("aliases", &self.0.aliases)?;
        }
        // order is ignored here
        map.end()
    }
}

impl Serialize for BoxEntity {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            BoxEntity::Record(record) => {
                let mut map = serializer.serialize_map(Some(4))?;
                map.serialize_entry("type", "record")?;
                map.serialize_entry("name", &record.name)?;
                map.serialize_entry("fields", &record.fields)?;
                map.serialize_entry("doc", &record.doc)?;
                // order is ignored here
                map.end()
            }
            BoxEntity::Enum(en) => {
                todo!()
            }
        }
    }
}

impl Visitor {
    fn grab_fields_get_deps_record(
        &self,
        into_fields: &mut Vec<BoxField>,
        into_deps: &mut Vec<String>,
        node: &ItemStruct,
    ) {
        self.grab_fields_get_deps_any(into_fields, into_deps, &node.fields);
    }

    fn grab_fields_get_deps_any(
        &self,
        into_fields: &mut Vec<BoxField>,
        into_deps: &mut Vec<String>,
        fields: &Fields,
    ) {
        let mut unnamed_index = 0;
        for field in fields.iter() {
            let (schema, dep_name) = self.map_type(&field.ty);
            if let Some(dep_name) = dep_name {
                into_deps.push(dep_name);
            }
            into_fields.push(BoxField(schema::Field {
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
            }))
        }
    }

    fn map_primitive(&self, prim: &str) -> Option<(Schema, Option<String>)> {
        match prim {
            "f64" => Some((Schema::Double, None)),
            "f32" => Some((Schema::Float, None)),
            "u32" => Some((Schema::Int(None), None)),
            "i32" => Some((Schema::Int(None), None)),
            "i64" => Some((Schema::Long(None), None)),
            "u64" => Some((Schema::Long(None), None)),
            "String" => Some((Schema::String(None), None)),
            "Uuid" => Some((Schema::String(Some(StringLogical::Uuid)), None)), // while not primitive, it's string-based
            _ => None,
        }
    }

    fn map_built_in_complex(&self, built_in: &Type) -> Option<(Schema, Option<String>)> {
        match built_in {
            Type::Path(tp) => {
                let first_segment = &tp.path.segments[0];
                let first_segment_name = first_segment.ident.to_string();
                if first_segment_name == "Option" {
                    let first_arg: TypePath =
                        get_first_type_arg_type_path(&first_segment.arguments);
                    let map_target_result = self.map_type(&Type::Path(first_arg));
                    return Some((
                        Schema::Union(vec![Schema::Null, map_target_result.0]),
                        map_target_result.1,
                    ));
                } else if first_segment_name == "Vec" {
                    let first_arg: TypePath =
                        get_first_type_arg_type_path(&first_segment.arguments);
                    let map_target_result = self.map_type(&Type::Path(first_arg));
                    return Some((
                        Schema::Array(Box::from(map_target_result.0)),
                        map_target_result.1,
                    ));
                }
                return None;
            }
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
                let map_primitive = self.map_primitive(first_segment_name.as_str());
                if map_primitive.is_some() {
                    return map_primitive.unwrap();
                }
                let map_build_in_complex = self.map_built_in_complex(ty);
                if map_build_in_complex.is_some() {
                    return map_build_in_complex.unwrap();
                }
                let map_reference = self.map_reference(first_segment_name.as_str());
                return map_reference;
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

fn get_first_type_arg_type_path(args: &PathArguments) -> TypePath {
    match args {
        PathArguments::AngleBracketed(args) => match &args.args[0] {
            GenericArgument::Type(ty) => match ty {
                Type::Path(tp) => tp.clone(),
                _ => panic!("Unsupported type {ty:?}"),
            },
            _ => panic!("Unsupported arg type: {:?}", args.args[0]),
        },
        _ => panic!("Unsupported path args {args:?}"),
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
            let mut record = BoxRecord {
                deps: vec![],
                name: struct_name.clone(),
                namespace: None,
                doc: Some("{\"version\": 1}".to_string()),
                fields: vec![],
            };

            self.grab_fields_get_deps_record(&mut record.fields, &mut record.deps, node);
            self.entities
                .insert(struct_name.clone(), BoxEntity::Record(record));
            eprintln!("Grabbed struct {}", struct_name);
        } else {
            eprintln!("Skipped struct {}", struct_name);
        }
        visit::visit_item_struct(self, node);
    }

    fn visit_item_enum(&mut self, node: &'ast ItemEnum) {
        return;
        // let enum_name = node.ident.to_string();
        // let analyze = if let Some(filter) = &self.filter {
        //     filter
        //         .iter()
        //         .any(|filter| enum_name.contains(filter.as_str()))
        // } else {
        //     true
        // };
        // if analyze {
        //     let mut union: Vec<Schema> = vec![];
        //     let mut deps: Vec<String> = vec![];
        //     for item in &node.variants {
        //         self.grab_fields_get_deps_enum_variant(&item, &mut union, &mut deps);
        //     }
        //     self.entities.insert(
        //         enum_name.clone(),
        //         BoxEntity::Enum(BoxEnum {
        //             enum_name: enum_name.clone(),
        //             deps,
        //             enum_variants: union,
        //         }),
        //     );
        //     eprintln!("Grabbed enum {}", enum_name);
        // } else {
        //     eprintln!("Skipped enum {}", enum_name);
        // }
        // visit::visit_item_enum(self, node);
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
        entities: HashMap::new(),
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
