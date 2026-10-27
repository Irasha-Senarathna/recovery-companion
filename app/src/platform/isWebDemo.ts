/**
 * Platform adapter pattern: `name.ts` is the phone version, `name.web.ts` the
 * web stand-in. Metro picks the right file per platform, so phone behaviour
 * never depends on web code.
 */
export function isWebDemo(): boolean {
  return false;
}
