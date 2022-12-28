use clap::command;
use std::collections::HashMap;
use std::fs;
use syn::visit::Visit;
use syn::{visit, Field, ItemFn};
use uuid::*;

struct FnVisitor;

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

impl<'ast> Visit<'ast> for FnVisitor {
    fn visit_field(&mut self, node: &'ast Field) {
        println!(
            "Field with name={}",
            node.ident
                .as_ref()
                .map(|i| i.to_string())
                .unwrap_or("unnamed".to_string())
        );
        visit::visit_field(self, node);
    }
}

fn main() {
    let cmd = clap::Command::new("avro-genschema")
        .bin_name("avro-genschema")
        .subcommand_required(true)
        .subcommand(
            command!("check")
                .arg(
                    clap::arg!(--"from" <PATH>)
                        .value_parser(clap::value_parser!(std::path::PathBuf)),
                )
                .arg(
                    clap::arg!(--"to" <PATH>).value_parser(clap::value_parser!(std::path::PathBuf)),
                ),
        );

    let matches = cmd.get_matches();
    let matches = match matches.subcommand() {
        Some(("check", matches)) => matches,
        _ => unreachable!("clap should ensure we don't get here"),
    };
    let from = matches.get_one::<std::path::PathBuf>("from");
    let to = matches.get_one::<std::path::PathBuf>("to");
    let file = if let Some(from) = from {
        if let Some(to) = to {
            let src = fs::read_to_string(from).expect("file not found");
            let ast = syn::parse_file(src.as_str())
                .expect(format!("Unable to create AST from file {:?}", from).as_str());
            Some(ast)
        } else {
            None
        }
    } else {
        None
    }
    .expect("could not parse file");
    FnVisitor.visit_file(&file)
}
