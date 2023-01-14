const { spawnWatched } = require('./shellspawn');

async function getVersions() {
  const gitVersion = (
    await spawnWatched('git rev-parse --short HEAD', {
      pipeStdout: true,
    })
  ).trim();
  const noChanges =
    (
      await spawnWatched('git status --porcelain', {
        pipeStdout: true,
      })
    ).trim() === '';
  const version = require('../package.json').version;
  return {
    gitVersion,
    version,
    gitLocalChanges: !noChanges,
  };
}

module.exports.getVersions = getVersions;
