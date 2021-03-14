jest.autoMockOff();
const defineTest = require('jscodeshift/dist/testUtils').defineTest;
defineTest(__dirname, 'reverse-identifiers');

defineTest(__dirname, 'reverse-identifiers', null, 'simple-union', {
  parser: 'ts',
});
