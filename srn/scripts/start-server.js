const { spawnWatched } = require('./shellspawn');
const { setupBuilderEnv } = require('./builder-env');

const tryKillServer = async () => {
  try {
    await spawnWatched('killall -9 srn-server');
  } catch (_e) {
    //suppress
  }
};

(async () => {
  try {
    await tryKillServer();
    await setupBuilderEnv({
      buildMethod: 'cargo run',
      buildOpt: 'debug',
    });
    await spawnWatched('RUST_BACKTRACE=1 cargo run -- --srn-server', {
      spawnOptions: {
        cwd: 'server',
      },
    });
  } catch (e) {
    console.error(e);
    process.exit(1);
  } finally {
    await tryKillServer();
  }
})();
