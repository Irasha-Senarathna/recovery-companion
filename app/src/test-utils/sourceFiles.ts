import fs from 'fs';
import path from 'path';

export const SRC_DIR = path.join(__dirname, '..');

/** App source files (tests and test helpers excluded), relative to src/. */
export function listSourceFiles(extensions = ['.ts', '.tsx']): string[] {
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return ['__tests__', 'test-utils'].includes(entry.name) ? [] : walk(full);
      }
      return extensions.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
    });
  return walk(SRC_DIR).map((file) => path.relative(SRC_DIR, file));
}

export function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(SRC_DIR, relativePath), 'utf8');
}
