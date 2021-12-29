require('regenerator-runtime/runtime');
const { loadWasm, wasm, exposePerfStats } = require('./util');

const NodeEnvironment = require('jest-environment-node');
const { exposePerfStorage } = require('./perf');

class CustomEnvironment extends NodeEnvironment {
  async setup() {
    await (global.wasm || loadWasm()); // hacky global mem caching of wasm, only works with --runInBand
    this.global.wasm = wasm;
    global.wasm = wasm;
    this.global.perfStorage = global.perfStorage;
  }

  async teardown() {
    exposePerfStats();
  }

  dispose() {}
}

module.exports = CustomEnvironment;
