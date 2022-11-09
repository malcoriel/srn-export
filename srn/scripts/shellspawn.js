const _ = require('lodash');
const childProcess = require('child_process');
const Q = require('q');
const { oneLineTrim } = require('common-tags');

const spawnDetached = function (command, { args = [], spawnOptions } = {}) {
  const def = Q.defer();
  try {
    const child = childProcess.spawnSync(
      'cmd',
      [`/c ${command}`],
      args,
      _.merge(
        {
          detached: true,
          stdio: 'ignore',
        },
        spawnOptions
      )
    );
    def.resolve(child);
  } catch (e) {
    def.reject(e);
  }
  return def.promise;
};

const spawnWatched = function (
  cmd,
  { args = [], ignoreStdout, ignoreStderr, pipeStdout, spawnOptions } = {}
) {
  const def = Q.defer();
  const stdinMode = 'inherit';
  let stdoutMode;
  if (ignoreStdout) {
    stdoutMode = 'ignore';
  } else if (pipeStdout) {
    stdoutMode = 'pipe';
  } else {
    stdoutMode = 'inherit';
  }
  const stderrMode = ignoreStderr ? 'ignore' : 'inherit';
  const options = _.merge(
    { stdio: [stdinMode, stdoutMode, stderrMode], shell: true },
    spawnOptions
  );
  const child = childProcess.spawn(cmd, args, options);
  let stdout = '';
  child.on('exit', (code) => {
    if (code) {
      def.reject(oneLineTrim`command ${cmd} exited with ${code} error code. See it's output above.
      If there is no output, make sure your command puts its errors in stderr, not stdout`);
    } else {
      def.resolve(stdout);
    }
  });
  if (pipeStdout) {
    child.stdout.on('data', (data) => {
      stdout += data;
    });
  }
  return def.promise;
};

module.exports = {
  spawnWatched,
  spawnDetached,
};
