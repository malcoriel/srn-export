use crate::BoxEntity::Record;
use avro_schema::schema;
use avro_schema::schema::*;
use clap::command;
use serde::ser::SerializeSeq;
use serde::ser::{SerializeMap, SerializeStruct};
use serde::{Serialize, Serializer};
use std::any::Any;
use std::collections::hash_map::Iter;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use syn::token::Union;
use syn::visit::Visit;
use syn::{
    visit, Attribute, Field, Fields, GenericArgument, ItemEnum, ItemFn, ItemStruct, ItemType,
    PathArguments, Type, TypePath,
};
use topological_sort::TopologicalSort;
use uuid::Uuid;

#[derive(Debug)]
struct TypeTransformVisitor {
    entities: Vec<(String, BoxEntity)>,
    pub entities_index: HashMap<String, BoxEntity>,
    whitelist: Option<Vec<String>>,
    blacklist: Option<Vec<String>>,
}

impl TypeTransformVisitor {
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

    fn check_analyze(
        &mut self,
        enum_name: &String,
        attributes: &Vec<Attribute>,
        ignore_attrs: bool,
    ) -> bool {
        let blacklisted = if let Some(blacklist) = &self.blacklist {
            blacklist.iter().any(|filter| enum_name == filter.as_str())
        } else {
            false
        };

        let whitelisted = if let Some(filter) = &self.whitelist {
            filter
                .iter()
                .any(|filter| enum_name.contains(filter.as_str()))
        } else {
            false
        };

        let has_typescript_definition_attribute = attributes.iter().any(|attr| {
            let id = attr.path.segments[0].ident.to_string();
            if id != "derive" {
                return false;
            }
            attr.tokens.to_string().contains("TypescriptDefinition")
        });
        let analyze =
            (!blacklisted || whitelisted) && (has_typescript_definition_attribute || ignore_attrs);
        analyze
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
pub struct BoxSchema {
    pub deps: Vec<String>,
    pub name: String,
    pub schema: Schema,
}
#[derive(Debug, Clone)]
pub enum BoxEntity {
    Record(BoxRecord),
    Enum(BoxEnum),
    RawType(BoxSchema),
}

impl BoxEntity {
    fn get_deps(&self) -> &Vec<String> {
        match self {
            BoxEntity::Record(v) => &v.deps,
            BoxEntity::Enum(v) => &v.deps,
            BoxEntity::RawType(v) => &v.deps,
        }
    }
    fn get_name(&self) -> String {
        match self {
            BoxEntity::Record(r) => r.name.clone(),
            BoxEntity::Enum(e) => e.enum_name.clone(),
            BoxEntity::RawType(rt) => rt.name.clone(),
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
                // avro has a very dumb way of serializing tagged unions - make a record, make all fields optional, and make a bag
                map.serialize_entry("name", &en.enum_name)?;
                map.serialize_entry("type", "record")?;
                map.serialize_entry("fields", &{
                    let mut field_mix =
                        en.enum_variants
                            .iter()
                            .fold(Vec::<BoxField>::new(), |mut acc, curr| {
                                for field in curr.fields.iter() {
                                    let mut field_clone = field.clone();
                                    field_clone.0.schema =
                                        Schema::Union(vec![field_clone.0.schema, Schema::Null]);
                                    acc.push(field_clone)
                                }
                                acc
                            });
                    // attempt to support serde + avro
                    field_mix.push(BoxField(schema::Field {
                        name: "tag".to_string(),
                        doc: None,
                        schema: Schema::String(None),
                        default: None,
                        order: None,
                        aliases: vec![],
                    }));
                    field_mix
                })?;
                map.end()
            }
            BoxEntity::RawType(rt) => {
                let mut map = serializer.serialize_map(None)?;
                map.serialize_entry("name", &rt.name)?;
                map.serialize_entry("type", &rt.schema)?;
                map.end()
            }
        }
    }
}

impl TypeTransformVisitor {
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
            let (schema, dep_name) = self.map_type(&field.ty, side_effect_types);
            for dep_name in dep_name {
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

    fn map_primitive(&self, prim: &str) -> Option<(Schema, Vec<String>)> {
        match prim {
            "f64" => Some((Schema::Double, vec![])),
            "f32" => Some((Schema::Float, vec![])),
            "u32" => Some((Schema::Int(None), vec![])),
            "i32" => Some((Schema::Int(None), vec![])),
            "usize" => Some((Schema::Int(None), vec![])),
            "bool" => Some((Schema::Boolean, vec![])),
            "i64" => Some((Schema::Long(None), vec![])),
            "u64" => Some((Schema::Long(None), vec![])),
            "String" => Some((Schema::String(None), vec![])),
            "Uuid" => Some((Schema::String(Some(StringLogical::Uuid)), vec![])), // while not primitive, it's string-based
            _ => None,
        }
    }

    fn map_built_in_complex(
        &self,
        built_in: &Type,
        side_effect_types: &mut Vec<BoxEntity>,
    ) -> Option<(Schema, Vec<String>)> {
        match built_in {
            Type::Path(tp) => {
                let first_segment = &tp.path.segments[0];
                let first_segment_name = first_segment.ident.to_string();
                if first_segment_name == "Option" {
                    let first_arg = get_nth_type_arg_type_path(&first_segment.arguments, 0);
                    let map_target_result = self.map_type(&first_arg, side_effect_types);
                    return Some((
                        Schema::Union(vec![Schema::Null, map_target_result.0]),
                        map_target_result.1,
                    ));
                } else if first_segment_name == "Vec" || first_segment_name == "VecDeque" {
                    let first_arg = get_nth_type_arg_type_path(&first_segment.arguments, 0);
                    let map_target_result = self.map_type(&first_arg, side_effect_types);
                    return Some((
                        Schema::Array(Box::from(map_target_result.0)),
                        map_target_result.1,
                    ));
                } else if first_segment_name == "HashMap" {
                    let first_arg = get_nth_type_arg_type_path(&first_segment.arguments, 0);
                    let mut map_first = self.map_type(&first_arg, side_effect_types);
                    let second_arg = get_nth_type_arg_type_path(&first_segment.arguments, 1);
                    let mut map_second = self.map_type(&second_arg, side_effect_types);
                    let mut deps = vec![];
                    deps.append(&mut map_first.1);
                    // // strictly speaking, this has to be checked - in case the key is not string, it cannot be mapped
                    // // but this requires analysing aliases and their mappings, which is kind of complex - probably cannot be done here
                    // if match &map_first.0 {
                    //     Schema::String(_) => "String",
                    //     Schema::Fixed(fr) => {
                    //         if fr.name == "Uuid" {
                    //             "String"
                    //         } else {
                    //             "Unknown"
                    //         }
                    //     }
                    //     _ => "Unsupported",
                    // } != "String"
                    // {
                    //     panic!("Unsupported by avro map key {:?}", map_first);
                    // }
                    deps.append(&mut map_second.1);
                    let schema = Schema::Map(Box::new(map_second.0));
                    return Some((schema, deps));
                }
                return None;
            }
            _ => None,
        }
    }

    fn map_type(&self, ty: &Type, side_effect_types: &mut Vec<BoxEntity>) -> (Schema, Vec<String>) {
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
                let map_build_in_complex = self.map_built_in_complex(ty, side_effect_types);
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
                    name: format!("tuple-{}", Uuid::new_v4()).replace("-", "_"),
                    namespace: None,
                    doc: None,
                    aliases: vec![],
                    fields: tup
                        .elems
                        .iter()
                        .map(|e| {
                            let mapped_type = self.map_type(e, side_effect_types);
                            let type_dep = mapped_type.1;
                            type_dep
                                .iter()
                                .for_each(|td| collected_deps.push(td.clone()));
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
                return (schema_record, collected_deps);
            }
            // Type::Verbatim(_) => {}
            // _ => Schema::Null,
            _ => unimplemented!("Unknown type: {ty:?}"),
        }
    }
    fn map_reference(&self, reference: &str) -> (Schema, Vec<String>) {
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
            vec![ref_name],
        )
    }
}

fn get_nth_type_arg_type_path(args: &PathArguments, idx: usize) -> Type {
    match args {
        PathArguments::AngleBracketed(args) => match &args.args[idx] {
            GenericArgument::Type(ty) => match ty {
                _ => ty.clone(),
            },
            _ => panic!("Unsupported arg type: {:?}", args.args[idx]),
        },
        _ => panic!("Unsupported path args {args:?}"),
    }
}

impl<'ast> Visit<'ast> for TypeTransformVisitor {
    fn visit_item_type(&mut self, node: &'ast ItemType) {
        let type_name = node.ident.to_string();
        eprintln!("Started type alias {}", type_name);
        let analyze = self.check_analyze(&type_name, &node.attrs, true);
        if analyze {
            eprintln!("Grabbed type alias {}", type_name);
            let mut se = vec![];
            let mapped = self.map_type(&node.ty, &mut se);
            self.add(
                type_name.clone(),
                BoxEntity::RawType(BoxSchema {
                    deps: mapped.1,
                    name: type_name,
                    schema: mapped.0,
                }),
            )
        } else {
            eprintln!("Skipped type alias {}", type_name);
        }
        visit::visit_item_type(self, node);
    }

    fn visit_item_enum(&mut self, node: &'ast ItemEnum) {
        let enum_name = node.ident.to_string();
        eprintln!("Started enum {}", enum_name);

        let analyze = self.check_analyze(&enum_name, &node.attrs, false);

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
        let analyze = self.check_analyze(&struct_name, &node.attrs, false);
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
                .arg(clap::arg!(--"blacklist" <EXACT_NAMES>))
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
    let blacklist: Option<Vec<String>> = matches
        .get_one::<String>("blacklist")
        .map(|v| v.clone().split(",").map(|v| v.to_string()).collect());
    let to = matches
        .get_one::<PathBuf>("to")
        .expect("--to arg is required");

    let mut visitor = TypeTransformVisitor {
        entities: vec![],
        entities_index: Default::default(),
        whitelist: filter.clone(),
        blacklist: blacklist.clone(),
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
