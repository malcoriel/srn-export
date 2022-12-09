use clap::command;
use std::fs;

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
    if let Some(from) = from {
        if let Some(to) = to {
            let src = fs::read_to_string(from).expect("file not found");
            let ast = syn::parse_file(src.as_str())
                .expect(format!("Unable to create AST from file {:?}", from).as_str());
            println!("ast: {:?}", ast);
        }
    }
}
