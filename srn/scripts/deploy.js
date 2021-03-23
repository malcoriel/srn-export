const yargs = require('yargs');
const { spawnWatched } = require('../../core/util/shellspawn');

const fs = require('fs-extra');
const sshPort = '2233';
const sshHost = 'root@bubblegum.malcoriel.de';
const latestServerImageName = 'srn-server:latest';
const latestClientImageName = 'srn-client:latest';
const serverContainerName = 'srn-server-current';
const autoHealName = 'srn-server-autoheal';
const clientContainerName = 'srn-client-current';

const makeServerPaths = (version, gitVersion) => {
  const fullImageName = `srn-server:${version}-${gitVersion}`;
  const fullImageNamePathFriendly = fullImageName.replace(/:/g, '-');
  const builtImagePath = `server/docker-image/${fullImageNamePathFriendly}.tar`;
  return { fullImageName, builtImagePath, fullImageNamePathFriendly };
};

const makeClientPaths = (version, gitVersion) => {
  const fullImageName = `srn-client:${version}-${gitVersion}`;
  const fullImageNamePathFriendly = fullImageName.replace(/:/g, '-');
  const builtImagePath = `client/docker-image/${fullImageNamePathFriendly}.tar`;
  return { fullImageName, builtImagePath, fullImageNamePathFriendly };
};

async function getVersions() {
  const gitVersion = (
    await spawnWatched('git rev-parse --short HEAD', {
      pipeStdout: true,
    })
  ).trim();
  const version = require('../package.json').version;
  return { gitVersion, version };
}

const makeRemoteImagePath = (fullImageNamePathFriendly) =>
  `/opt/srn-docker/${fullImageNamePathFriendly}.tar`;

const doBuildServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    console.log('building server', { gitVersion, version });

    console.log('cleaning target...');
    await fs.remove('server/target/x86_64-unknown-linux-musl');

    console.log('building the binary...');
    await spawnWatched('docker rm -f rust-builder || true');
    await spawnWatched(
      `cd server && \
        docker run --name="rust-builder" -it -v $(pwd):/home/rust/src \
        -v cargo-git:/home/rust/.cargo/git \
        -v cargo-registry:/home/rust/.cargo/registry \
        -v target:/home/rust/src/target \
        ekidd/rust-musl-builder:nightly-2021-02-13 \
        /bin/bash -c "sudo chown -R rust:rust /home/rust/.cargo/git /home/rust/.cargo/registry /home/rust/src/target; cargo build --release;"\
        `
    );
    await fs.mkdirp('server/target/x86_64-unknown-linux-musl/release');
    await spawnWatched(
      'docker cp rust-builder:/home/rust/src/target/x86_64-unknown-linux-musl/release/ ./server/target/x86_64-unknown-linux-musl/'
    );
    await spawnWatched('docker rm -f rust-builder > /dev/null || true');

    console.log('packing into docker...');
    const { fullImageName, builtImagePath } = makeServerPaths(
      version,
      gitVersion
    );
    await spawnWatched(
      `cd server && docker build . -t ${fullImageName} -t ${latestServerImageName}`
    );

    console.log('exporting image to file...');
    await fs.mkdirp('server/docker-image');
    await spawnWatched(`docker save srn-server:latest > ${builtImagePath}`);
  } catch (e) {
    console.error(e);
  }
};
const doPushServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    const {
      builtImagePath,
      fullImageNamePathFriendly,
      fullImageName,
    } = makeServerPaths(version, gitVersion);
    console.log('pushing to remote', { gitVersion, version });

    console.log('uploading to remote...');
    const remoteImagePath = makeRemoteImagePath(fullImageNamePathFriendly);

    await spawnWatched(
      `scp -P ${sshPort} ${builtImagePath} ${sshHost}:${remoteImagePath}`
    );

    console.log('importing image remotely', {
      gitVersion,
      version,
      remoteImagePath,
    });

    console.log('importing and re-tagging the image on remote...');
    const sshBase = `ssh -p ${sshPort} ${sshHost}`;
    await spawnWatched(`${sshBase} docker load -i ${remoteImagePath}`);
    await spawnWatched(
      `${sshBase} docker tag ${latestServerImageName} ${fullImageName} `
    );
  } catch (e) {
    console.error(e);
  }
};

const doPushClient = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    const {
      builtImagePath,
      fullImageNamePathFriendly,
      fullImageName,
    } = makeClientPaths(version, gitVersion);
    console.log('pushing to remote', { gitVersion, version });

    console.log('uploading to remote...');

    const remoteImagePath = makeRemoteImagePath(fullImageNamePathFriendly);

    await spawnWatched(
      `scp -P ${sshPort} ${builtImagePath} ${sshHost}:${remoteImagePath}`
    );

    console.log('importing image remotely', {
      gitVersion,
      version,
      remoteImagePath,
    });

    console.log('importing and re-tagging the image on remote...');
    const sshBase = `ssh -p ${sshPort} ${sshHost}`;
    await spawnWatched(`${sshBase} docker load -i ${remoteImagePath}`);
    await spawnWatched(
      `${sshBase} docker tag ${latestServerImageName} ${fullImageName} `
    );
  } catch (e) {
    console.error(e);
  }
};
const doRemoteRestartServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();

    console.log('restarting the remote docker image', {
      gitVersion,
      version,
    });

    const sshBase = `ssh -p ${sshPort} ${sshHost}`;
    // kill existing image
    await spawnWatched(
      `${sshBase} docker rm -f ${serverContainerName} || true`
    );
    await spawnWatched(`${sshBase} docker rm -f ${autoHealName} || true`);
    await spawnWatched(
      `${sshBase} docker run -d -p 2794:2794 -p 2795:2795 -p 8000:8000 --restart=always --name=${serverContainerName} ${latestServerImageName}`
    );
    await spawnWatched(
      `${sshBase} docker run -d --restart=always -v /var/run/docker.sock:/var/run/docker.sock willfarrell/autoheal --name=${autoHealName}`
    );
  } catch (e) {
    console.error(e);
  }
};

const doLocalRestartServer = async () => {
  try {
    const { gitVersion, version } = await getVersions();

    console.log('restarting the local docker image', {
      gitVersion,
      version,
    });

    // kill existing image
    await spawnWatched(`docker rm -f ${serverContainerName} || true`);
    await spawnWatched(`docker rm -f ${autoHealName} || true`);
    await spawnWatched(
      `docker run -d -p 2794:2794 -p 2795:2795 -p 8000:8000 --restart=always --name=${serverContainerName} ${latestServerImageName}`
    );
    await spawnWatched(
      `docker run -d --restart=always -v /var/run/docker.sock:/var/run/docker.sock willfarrell/autoheal --name=${autoHealName}`
    );
  } catch (e) {
    console.error(e);
  }
};

const doRemoteRestartClient = async () => {
  try {
    const { gitVersion, version } = await getVersions();

    console.log('restarting the remote docker image', {
      gitVersion,
      version,
    });

    const sshBase = `ssh -p ${sshPort} ${sshHost}`;
    // kill existing image
    await spawnWatched(
      `${sshBase} docker rm -f ${clientContainerName} || true`
    );
    await spawnWatched(
      `${sshBase} docker run -d -p 3000:3000 --restart=always --name=${clientContainerName} ${latestClientImageName}`
    );
  } catch (e) {
    console.error(e);
  }
};

const doBuildClient = async () => {
  try {
    const { gitVersion, version } = await getVersions();
    console.log('building client', { gitVersion, version });

    console.log('building wasm...');
    await spawnWatched('yarn wasm-pack');
    console.log('building client...');
    await spawnWatched('cd client; yarn install; yarn build;');

    console.log('building docker image...');
    const { fullImageName, builtImagePath } = makeClientPaths(
      version,
      gitVersion
    );
    await spawnWatched(
      `cd client && docker build . -t ${fullImageName} -t ${latestClientImageName}`
    );

    console.log('exporting image to file...');
    await fs.mkdirp('client/docker-image');
    await spawnWatched(
      `docker save ${latestClientImageName} > ${builtImagePath}`
    );
  } catch (e) {
    console.error(e);
  }
};

(async function () {
  try {
    await yargs
      .command(
        'server',
        'builds and deploys the server',
        (args) => args,
        async () => {
          await doBuildServer();
          await doPushServer();
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
        'pushes the server image to remote & tags it',
        (args) => args,
        doPushServer
      )
      .command(
        'remote-restart-server',
        'restarts the currently running server',
        (args) => args,
        doRemoteRestartServer
      )
      .command(
        'restart-local-server',
        'restarts the currently running server locally',
        (args) => args,
        doLocalRestartServer
      )
      .command(
        'client',
        'builds and deploys the client',
        (args) => args,
        async () => {
          await doBuildClient();
          await doPushClient();
          await doRemoteRestartClient();
        }
      )
      .command(
        'build-client',
        'builds the client',
        (args) => args,
        doBuildClient
      )
      .command(
        'push-client',
        'pushes the client image to remote and tags it',
        (args) => args,
        doPushClient
      )
      .command(
        'remote-restart-client',
        'restarts the currently running client',
        (args) => args,
        doRemoteRestartClient
      )
      .demandCommand()
      .parse();
  } catch (e) {
    console.error(e);
  }
})();
