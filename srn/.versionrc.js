const toml = require('@iarna/toml');
const fs = require('fs-extra');

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

let version = serverCargoToml.updater.readVersion(
  fs.readFileSync(serverCargoToml.filename)
);

console.log({ version });
console.log({
  out: serverCargoToml.updater.writeVersion(
    fs.readFileSync(serverCargoToml.filename),
    version
  ),
});

module.exports = {
  bumpFiles: [clientPackageJson, clientVersionJson, serverCargoToml],
  packageFiles: [clientPackageJson, clientVersionJson, serverCargoToml],
};
