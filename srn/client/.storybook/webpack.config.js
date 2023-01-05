
module.exports = async ({ config }) => {
  config.experiments.asyncWebAssembly = true;
  // console.log(config.module.rules);
  return config;
};
