const { spawnWatched } = require('./shellspawn');
(async () => {
  const filesToTypes = {
    'vec2.rs': ['Vec2f64'],
    'world.rs': ['SpatialProps'],
  };
  for (const [file, types] of Object.entries(filesToTypes)) {
    await spawnWatched(
      `cargo run generate --from ../server/src/${file} --filter="${types.join(
        ','
      )}" --to ../server/resources/avro_schemas`,
      { spawnOptions: { cwd: './avro-genschema' } }
    );
  }
})();
