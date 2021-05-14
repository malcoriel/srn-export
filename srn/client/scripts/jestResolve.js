module.exports = (request, options) => {
  return options.defaultResolver(request, {
    ...options,
    packageFilter: (pkg) => {
      // jest resolver doesn't like d.ts file as main, so we have to force it
      if (pkg.name === 'world') {
        return {
          ...pkg,
          main: 'world.d.ts',
        };
      }
      return {
        ...pkg,
      };
    },
  });
};
