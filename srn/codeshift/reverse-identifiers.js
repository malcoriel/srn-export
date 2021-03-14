function transform(file, api) {
  const j = api.jscodeshift;
  return j(file.source)
    .find(j.Identifier)
    .replaceWith(
      p => Object.assign({}, p.node, {
        name: p.node.name.split('').reverse().join('')
      })
    )
    .toSource();
}

module.exports = transform;
module.exports.parser = 'ts';