const fs = require('fs-extra');
const path = require('path');
(async () => {
  const tpl = (
    await fs.readFile('scripts/dialogueResources.template')
  ).toString();
  const resources = await fs.readdir('./server/resources/dialogue_scripts');
  let injected = '';
  for (const file of resources.filter((f) => f.endsWith('json'))) {
    const name = file.replace(path.extname(file), '');
    injected += `  ${name}: JSON.stringify(\r\n    require('../../../server/resources/dialogue_scripts/${file}')\r\n  ),\r\n`;
  }
  await fs.writeFile(
    './client/src/HtmlLayers/dialogueResources.ts',
    tpl.replace('$INJECT', injected.replace(/\r\n$/, ''))
  );
})();
