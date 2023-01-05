
module.exports = async ({ config }) => {
  config.experiments.asyncWebAssembly = true;
  // const babelLoaderRule = config.module.rules[0];
  // babelLoaderRule.use[0].options = {
  //   ...babelLoaderRule.use[0].options,
  //   customize: require.resolve(
  //     'babel-preset-react-app/webpack-overrides'
  //   ),
  //   presets: [
  //     [
  //       require.resolve('babel-preset-react-app'),
  //     ],
  //   ]
  // };
  return config;
};
