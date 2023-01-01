const { spawnWatched } = require('./shellspawn');
const fs = require('fs-extra');
(async () => {
  const files = fs
    .readdirSync('./server/src')
    .map((f) => `../server/src/${f}`)
    .join(',');
  const filter = [
    'Vec2f64',
    'SpatialProps',
    'PlanetV2',
    'RotationMovement',
    'Movement',
  ].join(',');

  await spawnWatched(
    `cargo run generate --from="${files}" --to ../server/resources/avro_schemas`,
    { spawnOptions: { cwd: './avro-genschema' } }
  );
})();
