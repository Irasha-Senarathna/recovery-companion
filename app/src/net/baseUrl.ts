/**
 * A laptop service address from `app/.env`, or null when not set. Plain http
 * (where anyone on the same Wi-Fi could read the traffic) is allowed only in
 * development builds or for this computer itself; anything else must use https.
 */
export function checkedBaseUrl(url: string | undefined, dev: boolean): string | null {
  if (!url) return null;
  if (url.startsWith('https://')) return url;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
  return url.startsWith('http://') && (dev || local) ? url : null;
}

/** True for plain http to another computer: anyone on the same Wi-Fi could read it. */
export function isUnencrypted(url: string | null): boolean {
  if (!url?.startsWith('http://')) return false;
  return !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
}
