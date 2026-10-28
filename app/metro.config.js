// https://docs.expo.dev/guides/customizing-metro/
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// content/ (helplines.json, disclaimer.md) sits next to app/ and is edited
// and verified by the developer, never copied into the app source.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../content')];

// Import Markdown content as plain text.
config.resolver.sourceExts.push('md');
config.transformer.babelTransformerPath = require.resolve('./metro.transformer.js');

// sql.js (web demo database) mentions Node modules it never uses in a browser.
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === 'web' &&
    ['node:fs', 'node:crypto', 'fs', 'crypto', 'path'].includes(moduleName)
  ) {
    return { type: 'empty' };
  }
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
