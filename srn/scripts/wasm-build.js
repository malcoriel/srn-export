const { spawnWatched } = require('../../core/util/shellspawn');
const fs = require('fs-extra');
const isWin = process.platform === 'win32';
const yargs = require('yargs');

async function buildForWeb() {
  console.log('Building rust code for extracting TS definitions...');
  await spawnWatched(
    'yarn cross-env-shell WASM32=1 "cd world && cargo +nightly build --target wasm32-unknown-unknown"',
    {
      spawnOptions: {
        cwd: 'world',
      },
    }
  );
  const mainBuildCommand =
    'wasm-bindgen target/wasm32-unknown-unknown/debug/world.wasm --typescript --out-dir pkg-bindgen';
  await spawnWatched(
    isWin ? mainBuildCommand : `bash -c "${mainBuildCommand}"`,
    {
      spawnOptions: {
        cwd: 'world',
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
  console.log('Running codemods...');
  await spawnWatched(
    'yarn jscodeshift -t codeshift/make-smart-enums.ts --extensions=ts world/pkg/world.d.ts'
  );
  await spawnWatched(
    'yarn jscodeshift -t codeshift/make-builder-classes.ts --extensions=ts world/pkg/world.d.ts'
  );
  const file = (await fs.readFile('world/pkg/world.d.ts')).toString();
  const builderClassFinder = /\/\/ start builder class (\w+)(?:.|\n|\r)*export class \1(?:.|\n|\r)*end builder class \1/gm;
  const enumFinder = /^export enum .+$/gm;
  const extractedBuilders = file.match(builderClassFinder);
  const extractedEnums = file.match(enumFinder);
  const cleanedFile = file
    .replace(builderClassFinder, '')
    .replace(enumFinder, '')
    .replace(/Uuid/gm, 'string')
    .replace(/key: InventoryItemType/gm, 'key in InventoryItemType');
  const extraImportsFile = `
    import { InventoryItemType } from './world.extra';
  `;
  await fs.writeFile('world/pkg/world.d.ts', cleanedFile + extraImportsFile);
  const builders = `type Uuid = string; \n${extractedBuilders.join('\n\n')}`;
  const enums = extractedEnums.join('\n\n');
  await fs.writeFile('world/pkg/world.extra.ts', `${enums}\n\n${builders}`);
  console.log('Done, ts definitions + wasm binary are ready!');
}

async function buildForTests() {
  console.log('Building rust code...');
  await spawnWatched(
    'yarn cross-env-shell WASM32=1 "cd world && cargo +nightly build --target wasm32-unknown-unknown"',
    {
      spawnOptions: {
        cwd: 'world',
      },
    }
  );
  const mainBuildCommand =
    'wasm-bindgen target/wasm32-unknown-unknown/debug/world.wasm --no-modules --out-dir pkg-nomodule';
  await fs.remove('world/pkg-nomodule');
  await spawnWatched(
    isWin ? mainBuildCommand : `bash -c "${mainBuildCommand}"`,
    {
      spawnOptions: {
        cwd: 'world',
      },
    }
  );
  console.log('Patching code...');
  let file = (await fs.readFile('world/pkg-nomodule/world.js')).toString();
  file = file.replace('let wasm_bindgen;', 'export let wasm_bindgen;');
  // module.require is broken for some reason form wasm-bindgen, and it fails rust/getrandom requiring global crypto api
  file = file.replace(
    'module.require(getStringFromWasm0(arg0, arg1));',
    'require(getStringFromWasm0(arg0, arg1));'
  );
  const prependData = '// This file is auto-generated and patched';
  const appendData = `
// this function is needed because of strange loading pattern of the wasm module
// that overrides already exported wasm_bindgen, which is first a function,
// and then an object with extra fields
export const getBindgen = () => {
  return wasm_bindgen;
}
  `;
  const patchedFile = `${prependData}\n${file}\n${appendData}`;
  await fs.writeFile('world/pkg-nomodule/world.js', patchedFile);

  console.log('Done, file is ready!');
}

(async function () {
  yargs
    .command('$0', 'default command - build for web', async () => {
      try {
        await buildForWeb();
      } catch (e) {
        process.exit(1);
      }
    })
    .command(
      'forTests',
      'build no-module version with some extras for jest consumption',
      async () => {
        try {
          await buildForTests();
        } catch (e) {
          process.exit(1);
        }
      }
    )
    .parse();
})();
