const simpleGit = require('simple-git/promise');
const yargs = require('yargs');
const SV = require('standard-version');

const toml = require('@iarna/toml');

const mainPackageJson = {
  filename: 'package.json',
  type: 'json',
};
const clientPackageJson = {
  filename: 'client/package.json',
  type: 'json',
};

const clientVersionJson = {
  filename: 'client/version.json',
  type: 'json',
};

const serverCargoToml = {
  filename: 'server/Cargo.toml',
  updater: {
    readVersion(contents) {
      return toml.parse(contents).package.version;
    },
    writeVersion(contents, version) {
      const cargo = toml.parse(contents);
      cargo.package.version = version;
      return toml.stringify(cargo);
    },
  },
};

const worldCargoToml = {
  filename: 'world/Cargo.toml',
  updater: {
    readVersion(contents) {
      return toml.parse(contents).package.version;
    },
    writeVersion(contents, version) {
      const cargo = toml.parse(contents);
      cargo.package.version = version;
      return toml.stringify(cargo);
    },
  },
};

(async () => {
  try {
    yargs
      .command(
        '$0 <releaseAs>',
        'the default command',
        (cmdYargs) => {
          return cmdYargs
            .option('force', { type: 'boolean', alias: 'f' })
            .positional('releaseAs', {
              type: 'string',
              choices: ['patch', 'minor', 'major'],
            }).argv;
        },
        async (argv) => {
          const { force, releaseAs } = argv;
          const git = simpleGit();
          const gitStatus = await git.status();
          const changedFilesCount = gitStatus.files.length;
          if (changedFilesCount && !force) {
            console.error(
              `${changedFilesCount} modified files found. Please commit them first!`,
            );
            return;
          }
          if (gitStatus.current !== 'master' && !force) {
            console.error(
              `Current branch ${gitStatus.current} is not master. Upping version is forbidden here`,
            );
            return;
          }
          await SV({
            message: 'chore($srn): release v%s',
            commitAll: true,
            tagPrefix: 'srn-v',
            releaseAs,
            skip: {
              changelog: true,
            },
            bumpFiles: [
              mainPackageJson,
              clientPackageJson,
              clientVersionJson,
              serverCargoToml,
              worldCargoToml,
            ],
            packageFiles: [
              mainPackageJson,
              clientPackageJson,
              clientVersionJson,
              serverCargoToml,
              worldCargoToml,
            ],
          });
        },
      )
      .help()
      .version(false)
      .parse();
  } catch (e) {
    console.error(e);
  }
})();
