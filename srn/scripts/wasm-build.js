const { spawnWatched } = require('../../core/util/shellspawn');
const fs = require('fs-extra');

(async function () {
  console.log('Fixing typescript definitions...');
  await spawnWatched(
    'yarn cross-env-shell WASM32=1 "cd world && cargo +nightly build --target wasm32-unknown-unknown"',
    {
      spawnOptions: {
        cwd: 'world',
      },
    }
  );
  await spawnWatched(
    'wasm-bindgen target/wasm32-unknown-unknown/debug/world.wasm --typescript --out-dir pkg-bindgen',
    {
      spawnOptions: {
        cwd: 'world',
        env: {
          WASM32: 1,
        },
      },
    }
  );
  await fs.move('world/pkg-bindgen/world.d.ts', 'world/world.d.ts.tmp', {
    overwrite: true,
  });
  await fs.remove('world/pkg-bindgen');
  console.log('Done, now building actual wasm...');
  await spawnWatched('wasm-pack build --release', {
    spawnOptions: {
      cwd: 'world',
    },
  });
  console.log('Moving extracted d.ts into pkg...');
  await fs.move('world/world.d.ts.tmp', 'world/pkg/world.d.ts', {
    overwrite: true,
  });
  console.log('Done');
})();
