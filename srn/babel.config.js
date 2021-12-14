module.exports = {
  plugins: [
    ['@babel/syntax-decorators', { decoratorsBeforeExport: true }],
    [
      'transform-class-properties',
      {
        loose: true,
      },
    ],
    [
      '@babel/plugin-proposal-class-properties',
      {
        loose: true,
      },
    ],
    [
      '@babel/plugin-proposal-private-methods',
      {
        loose: true,
      },
    ],
  ],
  presets: ['@babel/env', '@babel/react', '@babel/typescript'],
  ignore: ['**/*.wasm'],
};
