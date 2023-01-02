const { spawnWatched } = require('./shellspawn');
const fs = require('fs-extra');
(async () => {
  const blacklistFiles = new Set(['main.rs', 'main_ws_server.rs', 'chat.rs']);
  const blacklistEntities = [
    'ClientErr',
    'Room',
    'ClientMarker',
    'RoomIdResponse',
    'RoomsState',
    'CurrState',
    'NextState',
    'PrevState',
  ].join(',');
  const files = fs
    .readdirSync('./server/src')
    .filter((file) => !blacklistFiles.has(file))
    .map((f) => `../server/src/${f}`)
    .join(',');

  await spawnWatched(
    `cargo run generate --from="${files}" --blacklist=${blacklistEntities} --to ../server/resources/avro_schemas`,
    { spawnOptions: { cwd: './avro-genschema' } }
  );
})();
