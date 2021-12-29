require('regenerator-runtime/runtime');
const { loadWasm, wasm } = require('./util');

const NodeEnvironment = require('jest-environment-node');

class CustomEnvironment extends NodeEnvironment {
  async setup() {
    await (global.wasm || loadWasm()); // hacky global mem caching of wasm, only works with --runInBand
    this.global.wasm = wasm;
    global.wasm = wasm;
  }

  async teardown() {}

  dispose() {}
}

module.exports = CustomEnvironment;
