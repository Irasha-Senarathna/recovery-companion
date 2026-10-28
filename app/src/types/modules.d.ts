// Markdown content files (content/disclaimer.md) are imported as plain text.
declare module '*.md' {
  const text: string;
  export default text;
}

// The pure-JS build of sql.js (no wasm), used by the web demo and tests.
declare module 'sql.js/dist/sql-asm.js' {
  import initSqlJs from 'sql.js';
  export default initSqlJs;
}
