const { spawnWatched } = require('./shellspawn');
const fs = require('fs-extra');
const isWin = process.platform === 'win32';
const yargs = require('yargs');

async function buildForWeb({
  noTransform,
  transformOnly,
  noCleanTmp,
  debug,
  profiling,
}) {
  if (!transformOnly) {
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
    console.log('wasm-pack version used:');
    await spawnWatched('wasm-pack --version');
    let optValue;
    if (debug) {
      optValue = '--debug';
    } else {
      optValue = profiling ? '--profiling' : '--release';
    }
    const wasmPackCmd = `wasm-pack build ${optValue} `;
    console.log(`Executing ${wasmPackCmd}`);
    await spawnWatched(wasmPackCmd, {
      spawnOptions: {
        cwd: 'world',
      },
    });
    console.log('Patching code...');
    let file = (await fs.readFile('world/pkg/world_bg.js')).toString();
    // wasm-pack 0.2.83 generates somehow invalid binding to some _free functions, but it depends on if they are used
    // so for my code specifically, I have to monkey-patch some generated potentially-unused code that triggers webpack errors
    file = file.replace(
      'wasm.__wbg_writestream_free(ptr)',
      "console.warn('attempt to use a snipped out function'); // patch for non-existent import"
    );
    file = file.replace(
      'wasm.__wbg_readstream_free(ptr);',
      "console.warn('attempt to use a snipped out function'); // patch for non-existent import"
    );
    if (file.indexOf('patch for non-existent import') === -1) {
      throw new Error(
        'wasm-pack patch failed, webpack import might not work! Likely wasm-pack version used is not the one that is required.'
      );
    }
    await fs.writeFile('world/pkg/world_bg.js', file);
  }
  if (!noTransform) {
    console.log('Copying extracted d.ts into pkg...');
    await fs.copy('world/world.d.ts.tmp', 'world/pkg/world.d.ts', {
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
    // this can, of course, be generated, but I'm lazy =)
    const extraExtraImports = `
    import { Vec2f64, ObjectSpecifier, ManualMoveUpdate, LongActionStart,
    InventoryAction, NotificationActionR, SandboxCommand, TradeAction, NotificationText, ShootTarget,
    SBAddPlanet, SBTeleport, SBSetupState
    } from "./world"
    `;
    console.log('writing the extra file');
    await fs.writeFile(
      'world/pkg/world.extra.ts',
      `${extraExtraImports}\n\n${enums}\n\n${builders}`
    );
    if (!noCleanTmp) {
      console.log('deleting original tmp file...');
      await fs.unlink('world/world.d.ts.tmp');
    }
    console.log('Done, ts definitions + wasm binary are ready!');
  }
}

async function buildForTests({ release }) {
  console.log('Building rust code...');
  await spawnWatched(
    `yarn cross-env-shell WASM32=1 "cd world && cargo +nightly build ${
      release ? '--release' : ''
    } --target wasm32-unknown-unknown"`,
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
  file = file.replace(
    'let wasm_bindgen;',
    'export let wasm_bindgen; // patch for wasm-bindgen+jest'
  );
  file = file.replace(
    'const ret = performance',
    'const ret = require("perf_hooks").performance;'
  );

  // // new version of require-patching for jest in wasm-bindgen 0.2.79 (may differ for other versions)
  // file = file.replace(
  //   'var ret = getObject(arg0).require(getStringFromWasm0(arg1, arg2));',
  //   'var ret = require(getStringFromWasm0(arg1, arg2)); '
  // );

  if (file.indexOf('patch for wasm-bindgen+jest') === -1) {
    throw new Error(
      'wasm-bindgen export patch has failed, wasm init from jest will not work!'
    );
  }

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
    .command(
      '$0',
      'default command - build for web',
      (argv) =>
        argv
          .option('noTransform', {
            type: 'boolean',
            default: false,
          })
          .option('transformOnly', {
            type: 'boolean',
            default: false,
          })
          .option('noCleanTmp', {
            type: 'boolean',
            default: false,
          })
          .option('debug', {
            type: 'boolean',
            default: false,
          }),
      async ({ noTransform, transformOnly, noCleanTmp, debug, profiling }) => {
        try {
          await buildForWeb({
            noTransform,
            transformOnly,
            noCleanTmp,
            debug,
            profiling,
          });
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      }
    )
    .command(
      'forTests',
      'build no-module version with some extras for jest consumption',
      (argv) =>
        argv.option('release', {
          type: 'boolean',
          default: false,
        }),
      async ({ release }) => {
        try {
          await buildForTests({ release });
        } catch (e) {
          console.error(e);
          process.exit(1);
        }
      }
    )
    .parse();
})();
