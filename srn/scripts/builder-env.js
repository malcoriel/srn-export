const _ = require('lodash');
const { getVersions } = require('./git');
const setupBuilderEnv = async ({ buildMethod, buildOpt }) => {
  const { gitVersion, version, gitLocalChanges } = await getVersions();
  _.merge(process.env, {
    APP_VERSION: String(version),
    GIT_VERSION: String(gitVersion),
    BUILD_METHOD: String(buildMethod),
    BUILD_OPT: String(buildOpt),
    GIT_LOCAL_CHANGES: String(gitLocalChanges),
  });
};

module.exports.setupBuilderEnv = setupBuilderEnv;
