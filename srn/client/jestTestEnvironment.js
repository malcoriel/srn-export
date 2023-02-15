require('regenerator-runtime/runtime');

const NodeEnvironment = require('jest-environment-jsdom');

class CustomEnvironment extends NodeEnvironment {
  async setup() {}

  async teardown() {}

  dispose() {}
}

module.exports = CustomEnvironment;
