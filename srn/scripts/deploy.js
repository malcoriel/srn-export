const yargs = require('yargs');
const { spawnWatched } = require('./shellspawn');

const fs = require('fs-extra');
const { getVersions } = require('./git');
const { setupBuilderEnv } = require('./builder-env');
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
  return {
    fullImageName,
    builtImagePath,
    fullImageNamePathFriendly,
  };
};

const makeClientPaths = (version, gitVersion) => {
  const fullImageName = `srn-client:${version}-${gitVersion}`;
  const fullImageNamePathFriendly = fullImageName.replace(/:/g, '-');
  const builtImagePath = `client/docker-image/${fullImageNamePathFriendly}.tar`;
  return {
    fullImageName,
    builtImagePath,
    fullImageNamePathFriendly,
  };
};

const makeRemoteImagePath = (fullImageNamePathFriendly) =>
  `/opt/srn-docker/${fullImageNamePathFriendly}.tar`;

const doBuildServer = async () => {
  const { gitVersion, version, gitLocalChanges } = await getVersions();
  if (gitLocalChanges) {
    throw new Error(
      'Cannot deploy when there are local changes. Commit first to make the git version accurate'
    );
  }

  const envValues = await setupBuilderEnv({
    buildMethod: 'muslrust',
    buildOpt: 'release',
  });

  console.log('building server', {
    gitVersion,
    version,
  });

  console.log('fixing permissions...');
  await spawnWatched('chmod 777 server/Cargo.lock');

  console.log('building the binary...');
  await spawnWatched('docker rm -f rust-builder || true');
  const injectedEnv = Object.entries(envValues)
    .map(([k, v]) => `-e ${k}="${v}"`)
    .join(' ');
  await spawnWatched(
    `cd server && \
        docker run \
        --name="rust-builder" -it -v $PWD:/volume \
        -e CARGO_TARGET_DIR=target-rust-builder \
        ${injectedEnv} \
        -v cargo-cache:/root/.cargo/registry \
        clux/muslrust:1.67.0-nightly-2022-12-09 \
        /bin/bash -c "cargo build --release;"\
        `
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
};
const doPushServer = async () => {
  const { gitVersion, version } = await getVersions();
  const {
    builtImagePath,
    fullImageNamePathFriendly,
    fullImageName,
  } = makeServerPaths(version, gitVersion);
  console.log('pushing to remote', {
    gitVersion,
    version,
  });

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
};

const doPushClient = async () => {
  const { gitVersion, version } = await getVersions();
  const {
    builtImagePath,
    fullImageNamePathFriendly,
    fullImageName,
  } = makeClientPaths(version, gitVersion);
  console.log('pushing to remote', {
    gitVersion,
    version,
  });

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
};
const doRemoteRestartServer = async () => {
  const { gitVersion, version } = await getVersions();

  console.log('restarting the remote docker image', {
    gitVersion,
    version,
  });

  const sshBase = `ssh -p ${sshPort} ${sshHost}`;
  // kill existing image
  await spawnWatched(`${sshBase} docker rm -f ${serverContainerName} || true`);
  await spawnWatched(`${sshBase} docker rm -f ${autoHealName} || true`);
  await spawnWatched(
    `${sshBase} docker run -d -p 2794:2794 -p 2795:2795 -p 8000:8000 --restart=always --name=${serverContainerName} ${latestServerImageName}`
  );
  await spawnWatched(
    `${sshBase} docker run -d --name=${autoHealName} --restart=always -v /var/run/docker.sock:/var/run/docker.sock willfarrell/autoheal`
  );
};

const doLocalRestartServer = async () => {
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
    `docker run -d --restart=always --name=${autoHealName} -v /var/run/docker.sock:/var/run/docker.sock willfarrell/autoheal`
  );
};

const doRemoteRestartClient = async () => {
  const { gitVersion, version } = await getVersions();

  console.log('restarting the remote docker image', {
    gitVersion,
    version,
  });

  const sshBase = `ssh -p ${sshPort} ${sshHost}`;
  // kill existing image
  await spawnWatched(`${sshBase} docker rm -f ${clientContainerName} || true`);
  await spawnWatched(
    `${sshBase} docker run -d -p 3000:3000 --restart=always --name=${clientContainerName} ${latestClientImageName}`
  );
};

const doBuildClient = async () => {
  const { gitVersion, version, gitLocalChanges } = await getVersions();
  if (gitLocalChanges) {
    throw new Error(
      'Cannot deploy when there are local changes. Commit first to make the git version accurate'
    );
  }

  console.log('building client', {
    gitVersion,
    version,
  });

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
};

const tryAndLog = (fn) => async () => {
  try {
    await fn();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

(async function () {
  try {
    yargs
      .command(
        'server',
        'builds and deploys the server',
        (args) => args,
        tryAndLog(async () => {
          await doBuildServer();
          await doPushServer();
          await doRemoteRestartServer();
        })
      )
      .command(
        'build-server',
        'only build docker image and export it to file',
        (args) => args,
        tryAndLog(doBuildServer)
      )
      .command(
        'push-server',
        'pushes the server image to remote & tags it',
        (args) => args,
        tryAndLog(doPushServer)
      )
      .command(
        'remote-restart-server',
        'restarts the currently running server',
        (args) => args,
        tryAndLog(doRemoteRestartServer)
      )
      .command(
        'restart-local-server',
        'restarts the currently running server locally',
        (args) => args,
        tryAndLog(doLocalRestartServer)
      )
      .command(
        'client',
        'builds and deploys the client',
        (args) => args,
        tryAndLog(async () => {
          await doBuildClient();
          await doPushClient();
          await doRemoteRestartClient();
        })
      )
      .command(
        'build-client',
        'builds the client',
        (args) => args,
        tryAndLog(doBuildClient)
      )
      .command(
        'push-client',
        'pushes the client image to remote and tags it',
        (args) => args,
        tryAndLog(doPushClient)
      )
      .command(
        'remote-restart-client',
        'restarts the currently running client',
        (args) => args,
        tryAndLog(doRemoteRestartClient)
      )
      .demandCommand()
      .parse();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
