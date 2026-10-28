// Jest: import a Markdown file (content/disclaimer.md) as a plain string,
// the same way metro.transformer.js does in the app bundle.
module.exports = {
  process(src) {
    return { code: `module.exports = ${JSON.stringify(src)};` };
  },
};
