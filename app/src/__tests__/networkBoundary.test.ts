import pkg from '../../package.json';
import { listSourceFiles, readSource } from '../test-utils/sourceFiles';

/**
 * Privacy: only src/net/ may talk to the network, so every byte that leaves
 * the phone goes through one reviewed place. No tracking SDKs, ever.
 */
const NETWORK_APIS = [
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\b/,
  /\bEventSource\b/,
  /\bnavigator\.sendBeacon\b/,
  /from ['"]axios['"]/,
  /from ['"]expo-file-system['"].*\b(upload|download)/s,
  /require\(\s*['"]axios['"]\s*\)/,
  /uri:\s*['"`]https?:/,
  /openURL\(\s*['"`]https?:/,
  /expo-web-browser|react-native-webview/,
];

const BANNED_DEPENDENCIES = [
  /analytics/i,
  /sentry/i,
  /bugsnag/i,
  /crashlytics/i,
  /segment/i,
  /amplitude/i,
  /mixpanel/i,
  /appsflyer/i,
  /adjust/i,
  /branch/i,
  /facebook/i,
  /admob|google-mobile-ads/i,
  /firebase/i,
  /posthog/i,
  /onesignal/i,
  /datadog/i,
  /newrelic/i,
  /appcenter/i,
  /instabug/i,
  /logrocket/i,
  /^expo-insights$/,
  // OTA updates contact Expo's servers with device and runtime headers.
  /^expo-updates$/,
];

describe('network boundary', () => {
  const outsideNet = listSourceFiles().filter((file) => !file.startsWith('net/'));

  it.each(outsideNet)('%s does not call the network directly', (file) => {
    const source = readSource(file);
    for (const api of NETWORK_APIS) expect(source).not.toMatch(api);
  });
});

describe('no tracking or ad SDKs', () => {
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });

  it.each(BANNED_DEPENDENCIES.map((p) => [p.source, p]))('no dependency matches %s', (_, p) => {
    expect(deps.filter((dep) => (p as RegExp).test(dep))).toEqual([]);
  });
});
