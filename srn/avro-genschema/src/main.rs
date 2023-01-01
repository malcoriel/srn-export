use crate::BoxEntity::Record;
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
use uuid::Uuid;

#[derive(Debug)]
struct Visitor {
    entities: Vec<(String, BoxEntity)>,
    pub entities_index: HashMap<String, BoxEntity>,
    filter: Option<Vec<String>>,
}

impl Visitor {
    fn add(&mut self, key: String, ent: BoxEntity) {
        self.entities_index.insert(key.clone(), ent.clone());
        self.entities.push((key, ent));
    }

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
            fields: vec![],
        };
        let mut side_effect_types = vec![];
        self.grab_fields_get_deps_any(
            &mut record.fields,
            into_deps,
            &mut side_effect_types,
            &en_var.fields,
        );
        collected_vars.push(record)
    }

    pub fn top_sorted_records(&self) -> Vec<Vec<(String, &BoxEntity)>> {
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
            layer.sort();
            if layer.len() == 0 {
                break;
            }
            sorted.push(layer)
        }
        eprintln!("sorted len={} {:?}", self.entities.len(), sorted);
        let res: Vec<Vec<(String, &BoxEntity)>> = sorted
            .into_iter()
            .map(|layer| {
                layer
                    .into_iter()
                    .filter_map(|name| {
                        let rec = self.entities_index.get(name.as_str());
                        if rec.is_none() {
                            unmapped_types.push(name.clone());
                        }
                        rec.map(|rec| (name.clone(), rec))
                    })
                    .collect()
            })
            .collect();
        if unmapped_types.len() > 0 {
            eprintln!(
                "\n========================\nUnmapped types: {:?}",
                unmapped_types
            );
        }
        res
    }
}

#[derive(Debug, Clone)]
pub struct BoxRecord {
    pub deps: Vec<String>,
    pub name: String,
    pub namespace: Option<String>,
    pub fields: Vec<BoxField>,
}

#[derive(Debug, Clone)]
pub struct BoxEnum {
    pub deps: Vec<String>,
    pub enum_name: String,
    pub enum_variants: Vec<BoxRecord>,
}
#[derive(Debug, Clone)]
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
    fn get_name(&self) -> String {
        match self {
            BoxEntity::Record(r) => r.name.clone(),
            BoxEntity::Enum(e) => e.enum_name.clone(),
        }
    }
}

#[derive(Debug, Clone)]
pub struct BoxField(schema::Field);

#[derive(Debug, Clone)]
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

impl Serialize for BoxRecord {
    fn serialize<S>(&self, mut serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut map = serializer.serialize_map(None)?;
        map.serialize_entry("type", "record")?;
        map.serialize_entry("name", &self.name)?;
        map.serialize_entry("fields", &self.fields)?;
        map.end()
    }
}

impl Serialize for BoxEntity {
    fn serialize<S>(&self, mut serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            BoxEntity::Record(record) => {
                let mut map = serializer.serialize_map(None)?;
                map.serialize_entry("type", "record")?;
                map.serialize_entry("name", &record.name)?;
                map.serialize_entry("fields", &record.fields)?;
                map.end()
            }
            BoxEntity::Enum(en) => {
                let mut map = serializer.serialize_map(None)?;
                map.serialize_entry("name", &en.enum_name)?;
                map.serialize_entry("type", &en.enum_variants)?;
                map.end()
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
        side_effect_types: &mut Vec<BoxEntity>,
    ) {
        self.grab_fields_get_deps_any(into_fields, into_deps, side_effect_types, &node.fields);
    }

    fn grab_fields_get_deps_any(
        &self,
        into_fields: &mut Vec<BoxField>,
        into_deps: &mut Vec<String>,
        side_effect_types: &mut Vec<BoxEntity>,
        fields: &Fields,
    ) {
        let mut unnamed_index = 0;
        for field in fields.iter() {
            let field_name = field.ident.as_ref().map_or_else(
                || {
                    unnamed_index += 1;
                    unnamed_index.to_string()
                },
                |id| id.to_string(),
            );
            let (schema, dep_name) =
                self.map_type(&field.ty, Some(field_name.clone()), side_effect_types);
            if let Some(dep_name) = dep_name {
                into_deps.push(dep_name);
            }
            into_fields.push(BoxField(schema::Field {
                name: field_name,
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
            "usize" => Some((Schema::Int(None), None)),
            "bool" => Some((Schema::Boolean, None)),
            "i64" => Some((Schema::Long(None), None)),
            "u64" => Some((Schema::Long(None), None)),
            "String" => Some((Schema::String(None), None)),
            "Uuid" => Some((Schema::String(Some(StringLogical::Uuid)), None)), // while not primitive, it's string-based
            _ => None,
        }
    }

    fn map_built_in_complex(
        &self,
        built_in: &Type,
        prepend_name: Option<String>,
        side_effect_types: &mut Vec<BoxEntity>,
    ) -> Option<(Schema, Option<String>)> {
        match built_in {
            Type::Path(tp) => {
                let first_segment = &tp.path.segments[0];
                let first_segment_name = first_segment.ident.to_string();
                if first_segment_name == "Option" {
                    let first_arg = get_first_type_arg_type_path(&first_segment.arguments);
                    let map_target_result =
                        self.map_type(&first_arg, prepend_name, side_effect_types);
                    return Some((
                        Schema::Union(vec![Schema::Null, map_target_result.0]),
                        map_target_result.1,
                    ));
                } else if first_segment_name == "Vec" {
                    let first_arg = get_first_type_arg_type_path(&first_segment.arguments);
                    let map_target_result =
                        self.map_type(&first_arg, prepend_name, side_effect_types);
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

    fn map_type(
        &self,
        ty: &Type,
        prepend_name: Option<String>,
        side_effect_types: &mut Vec<BoxEntity>,
    ) -> (Schema, Option<String>) {
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
                let map_build_in_complex =
                    self.map_built_in_complex(ty, prepend_name, side_effect_types);
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
            Type::Tuple(tup) => {
                // tuple has to emit an anonymous type along the way,
                let mut counter = 0;
                let mut collected_deps = vec![];
                let schema_record = Schema::Record(schema::Record {
                    name: format!("tuple-{}", Uuid::new_v4()),
                    namespace: None,
                    doc: None,
                    aliases: vec![],
                    fields: tup
                        .elems
                        .iter()
                        .map(|e| {
                            let mapped_type = self.map_type(e, None, side_effect_types);
                            let type_dep = mapped_type.1;
                            type_dep.map(|td| collected_deps.push(td));
                            let field = schema::Field {
                                name: counter.to_string(),
                                doc: None,
                                schema: mapped_type.0,
                                default: None,
                                order: None,
                                aliases: vec![],
                            };
                            counter += 1;
                            field
                        })
                        .collect(),
                });
                return (
                    schema_record,
                    if collected_deps.len() == 0 {
                        None
                    } else if collected_deps.len() == 1 {
                        Some(collected_deps[0].clone())
                    } else {
                        todo!("Need to support multiple type deps")
                    },
                );
            }
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

fn get_first_type_arg_type_path(args: &PathArguments) -> Type {
    match args {
        PathArguments::AngleBracketed(args) => match &args.args[0] {
            GenericArgument::Type(ty) => match ty {
                _ => ty.clone(),
            },
            _ => panic!("Unsupported arg type: {:?}", args.args[0]),
        },
        _ => panic!("Unsupported path args {args:?}"),
    }
}

impl<'ast> Visit<'ast> for Visitor {
    fn visit_item_enum(&mut self, node: &'ast ItemEnum) {
        let enum_name = node.ident.to_string();
        eprintln!("Started enum {}", enum_name);
        let analyze = if let Some(filter) = &self.filter {
            filter
                .iter()
                .any(|filter| enum_name.contains(filter.as_str()))
        } else {
            true
        };
        if analyze {
            let mut union: Vec<BoxRecord> = vec![];
            let mut deps: Vec<String> = vec![];
            for item in &node.variants {
                self.grab_fields_get_deps_enum_variant(&item, &mut union, &mut deps);
            }
            self.add(
                enum_name.clone(),
                BoxEntity::Enum(BoxEnum {
                    enum_name: enum_name.clone(),
                    deps,
                    enum_variants: union,
                }),
            );
            eprintln!("Grabbed enum {}", enum_name);
        } else {
            eprintln!("Skipped enum {}", enum_name);
        }
        visit::visit_item_enum(self, node);
    }

    fn visit_item_struct(&mut self, node: &'ast ItemStruct) {
        let struct_name = node.ident.to_string();
        eprintln!("Started struct {}", struct_name);
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
                fields: vec![],
            };

            let mut side_effect_types = vec![];
            self.grab_fields_get_deps_record(
                &mut record.fields,
                &mut record.deps,
                node,
                &mut side_effect_types,
            );
            self.add(struct_name.clone(), BoxEntity::Record(record));
            for side_effect_type in side_effect_types.into_iter() {
                self.add(side_effect_type.get_name(), side_effect_type);
            }
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
        entities: vec![],
        entities_index: Default::default(),
        filter: filter.clone(),
    };

    for file in from {
        let src = fs::read_to_string(file.clone()).expect("file not found");
        let file = syn::parse_file(src.as_str())
            .expect(format!("Unable to create AST from file {:?}", file).as_str());
        visitor.visit_file(&file);
    }
    if to.exists() {
        fs::remove_dir_all(to).expect("could not clean destination dir");
    }
    fs::create_dir(to).expect("could not create destination dir");
    let mut layer_counter = 0;
    for layer in visitor.top_sorted_records() {
        let mut item_counter = 0;
        layer_counter += 1;
        for (key, value) in layer {
            item_counter += 1;
            let mut file_path = to.clone();
            file_path.push(PathBuf::from(format!(
                "{layer_counter:0>2}-{item_counter:0>2}-{key}.json"
            )));
            let serialized = serde_json::to_string_pretty(value)
                .expect(format!("could not serialize record named {key}").as_str());
            fs::write(file_path.clone(), serialized)
                .expect(format!("could not write to file {file_path:?}").as_str());
        }
    }
}
