const { spawnWatched } = require('./shellspawn');
(async () => {
  const files = ['vec2.rs', 'world.rs']
    .map((f) => `../server/src/${f}`)
    .join(',');
  const filter = ['Vec2f64', 'SpatialProps'].join(',');

  await spawnWatched(
    `cargo run generate --from="${files}" --filter="${filter}" --to ../server/resources/avro_schemas`,
    { spawnOptions: { cwd: './avro-genschema' } }
  );
})();
