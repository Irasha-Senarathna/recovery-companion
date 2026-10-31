import appJson from '../../app.json';

type Plugin = string | [string, Record<string, unknown>];
const plugins = appJson.expo.plugins as Plugin[];
const options = (name: string) =>
  (
    plugins.find((p) => Array.isArray(p) && p[0] === name) as [string, Record<string, unknown>]
  )?.[1];

/** Privacy: the permissions the phone build asks for. */
describe('app permissions', () => {
  it('encrypts the database with SQLCipher', () => {
    expect(options('expo-sqlite')).toMatchObject({ useSQLCipher: true });
  });

  it('never asks for the camera', () => {
    expect(options('expo-image-picker')).toMatchObject({ cameraPermission: false });
  });

  it('keeps the microphone for voice notes (the image picker must not remove it)', () => {
    expect(options('expo-image-picker')).not.toHaveProperty('microphonePermission');
    expect(options('expo-audio')?.microphonePermission).toEqual(expect.any(String));
  });

  it('does not keep playing voice notes in the background', () => {
    expect(options('expo-audio')).toMatchObject({ enableBackgroundPlayback: false });
  });

  it('blocks broad storage access and Android cloud backup', () => {
    expect(appJson.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]),
    );
    expect(appJson.expo.android.allowBackup).toBe(false);
  });

  it('schedules the reminder without exact-alarm permissions', () => {
    expect(appJson.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.SCHEDULE_EXACT_ALARM',
        'android.permission.USE_EXACT_ALARM',
      ]),
    );
  });

  it('keeps Firebase from starting on its own (no push token or analytics unless opted in)', () => {
    expect(plugins).toContain('./plugins/withNoFirebaseAutoInit');
    expect(jest.requireActual('../../plugins/withNoFirebaseAutoInit').META).toEqual({
      firebase_messaging_auto_init_enabled: 'false',
      firebase_analytics_collection_deactivated: 'true',
    });
  });
});

/**
 * Privacy: the installed name shows on the home screen, in the app switcher
 * and on every notification, including on a locked phone. It must not hint at
 * recovery, drugs or treatment.
 */
describe('neutral app name', () => {
  const REVEALING = /recover|addict|drug|sober|rehab|relapse|craving|detox|substance|treatment/i;

  it('has a display name that says nothing about recovery', () => {
    expect(appJson.expo.name).not.toMatch(REVEALING);
    expect(appJson.expo.name.trim().length).toBeGreaterThan(0);
  });

  it('uses the same neutral name for the web tab title', () => {
    expect(appJson.expo.web).toMatchObject({ name: appJson.expo.name });
  });
});
