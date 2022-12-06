## Webpack CRA hacks to make it work with wasm + world
1. Remove eslint plugin to prevent too much dev-server noise
2. Add wasm to excludes of file-loader in the end
3. Add  experiments: `{ asyncWebAssembly: true }` to the end of config - needed for async import in webpack5
4. Remove module scope plugin - it will prevent world-pkg imports otherwise
5. Add worldPkg to files caught by babel loader, via path.resolve('../world/pkg') - it will refuse to take TS files otherwise
6.Add raw-loader with test: .txt|.md - it is needed for the changelog
