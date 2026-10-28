// Metro: import a Markdown file (content/disclaimer.md) as a plain string.
const path = require('path');

const expoDir = path.dirname(require.resolve('expo/package.json'));
const upstream = require(
  require.resolve('@expo/metro-config/babel-transformer', { paths: [expoDir] }),
);

module.exports.transform = (params) =>
  params.filename.endsWith('.md')
    ? upstream.transform({ ...params, src: `module.exports = ${JSON.stringify(params.src)};` })
    : upstream.transform(params);
