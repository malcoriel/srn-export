const yargs = require('yargs');
const { spawnWatched } = require('../../core/util/shellspawn');

const fs = require('fs-extra');
const sshPort = `2233`;
const sshHost = `root@bubblegum.malcoriel.de`;
const latestImageName = `srn-server:latest`;
const containerName = 'srn-server-current';

const makePaths = (version, gitVersion) => {
  let fullImageName = `srn-server:${version}-${gitVersion}`;
  const fullImageNamePathFriendly = fullImageName.replace(/:/g, '-');
  let builtImagePath = `server/docker-image/${fullImageNamePathFriendly}.tar`;
  return { fullImageName, builtImagePath, fullImageNamePathFriendly };
};

async function getVersions() {
  const gitVersion = (
    await spawnWatched(`git rev-parse --short HEAD`, {
      pipeStdout: true,
    })
  ).trim();
  const version = require('../package.json').version;
  return { gitVersion, version };
}

const makeRemoteImagePath = (fullImageNamePathFriendly) =>
  `/opt/srn-server-docker/${fullImageNamePathFriendly}.tar`;

let doBuildServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    console.log(`building server`, { gitVersion, version });

    console.log(`cleaning target...`);
    await fs.remove(`server/target/x86_64-unknown-linux-musl`);

    console.log('building the binary...');
    await spawnWatched(`docker rm -f rust-builder || true`);
    await spawnWatched(
      `cd server && \
          docker run --name="rust-builder" -it -v "$(pwd)":/home/rust/src \
          -v cargo-git:/home/rust/.cargo/git \
          -v cargo-registry:/home/rust/.cargo/registry \
          -v target:/home/rust/src/target \
          ekidd/rust-musl-builder \
          /bin/bash -c "sudo chown -R rust:rust /home/rust/.cargo/git /home/rust/.cargo/registry /home/rust/src/target; cargo build --release;"\
          `
    );
    await fs.mkdirp('server/target/x86_64-unknown-linux-musl/release');
    await spawnWatched(
      `docker cp rust-builder:/home/rust/src/target/x86_64-unknown-linux-musl/release/ ./server/target/x86_64-unknown-linux-musl/`
    );
    await spawnWatched(`docker rm -f rust-builder > dev/null || true`);

    console.log('packing into docker...');
    const { fullImageName, builtImagePath } = makePaths(version, gitVersion);
    await spawnWatched(
      `cd server && docker build . -t ${fullImageName} -t ${latestImageName}`
    );

    console.log('exporting image to file...');
    await fs.mkdirp('server/docker-image');
    await spawnWatched(`docker save srn-server:latest > ${builtImagePath}`);
  } catch (e) {
    console.error(e);
  }
};
let doPushServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    const { builtImagePath, fullImageNamePathFriendly } = makePaths(
      version,
      gitVersion
    );
    console.log(`pushing to remote`, { gitVersion, version });

    console.log('uploading to remote...');
    await spawnWatched(
      `scp -P ${sshPort} ${builtImagePath} ${sshHost}:${makeRemoteImagePath(
        fullImageNamePathFriendly
      )}`
    );
  } catch (e) {
    console.error(e);
  }
};
let doRemoteImportServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();

    const { fullImageNamePathFriendly, fullImageName } = makePaths(
      version,
      gitVersion
    );
    let remoteImagePath = makeRemoteImagePath(fullImageNamePathFriendly);

    console.log(`importing image remotely`, {
      gitVersion,
      version,
      remoteImagePath,
    });

    console.log('importing and re-tagging the image...');
    let sshBase = `ssh -p ${sshPort} ${sshHost}`;
    await spawnWatched(
      `${sshBase} docker import ${remoteImagePath} ${fullImageName}`
    );
    await spawnWatched(
      `${sshBase} docker tag ${fullImageName} ${latestImageName}`
    );
  } catch (e) {
    console.error(e);
  }
};
let doRemoteRestartServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();

    console.log(`restarting the remote docker image`, {
      gitVersion,
      version,
    });

    let sshBase = `ssh -p ${sshPort} ${sshHost}`;
    // kill existing image
    await spawnWatched(`${sshBase} docker kill ${containerName} || true`);
    await spawnWatched(
      `${sshBase} docker run -P --restart=always --name=${containerName} ${latestImageName}`
    );
  } catch (e) {
    console.error(e);
  }
};

(async function () {
  try {
    await yargs
      .command(
        'full-server',
        'does all the stages of deploy',
        (args) => args,
        async () => {
          await doBuildServer();
          await doPushServer();
          await doRemoteImportServer();
          await doRemoteRestartServer();
        }
      )
      .command(
        'build-server',
        'only build docker image and export it to file',
        (args) => args,
        doBuildServer
      )
      .command(
        'push-server',
        'push the image to remote',
        (args) => args,
        doPushServer
      )
      .command(
        'remote-import-server',
        'import the image into remote docker engine and re-tags it to be latest',
        (args) => args,
        doRemoteImportServer
      )
      .command(
        'remote-restart-server',
        'restarts the currently running server',
        (args) => args,
        doRemoteRestartServer
      )
      .demandCommand()
      .parse();
  } catch (e) {
    console.error(e);
  }
})();
