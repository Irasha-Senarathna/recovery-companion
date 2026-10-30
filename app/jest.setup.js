// Test doubles for phone-only native modules. Real behaviour is unchanged on
// the phone; these only let the JS logic run under Jest.

jest.mock('expo-crypto', () => ({
  getRandomBytesAsync: async (count) => new Uint8Array(require('crypto').randomBytes(count)),
}));

jest.mock('expo-secure-store', () => {
  const items = new Map();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 5,
    getItemAsync: jest.fn(async (key) => items.get(key) ?? null),
    setItemAsync: jest.fn(async (key, value) => {
      items.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key) => {
      items.delete(key);
    }),
    __items: items,
  };
});

jest.mock('expo-sqlite', () => require('./src/test-utils/fakeExpoSqlite'));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  authenticateAsync: jest.fn(async () => ({ success: false, error: 'not_available' })),
}));

jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: jest.fn(),
}));

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(async () => false),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

beforeEach(() => {
  require('expo-secure-store').__items.clear();
  require('expo-sqlite').__reset();
});

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
}));

jest.mock('expo-audio', () => ({
  RecordingPresets: { LOW_QUALITY: {} },
  useAudioRecorder: jest.fn(() => ({
    prepareToRecordAsync: jest.fn(async () => {}),
    record: jest.fn(),
    stop: jest.fn(async () => {}),
    uri: null,
  })),
  createAudioPlayer: jest.fn(() => ({
    play: jest.fn(),
    pause: jest.fn(),
    remove: jest.fn(),
    addListener: jest.fn(() => ({ remove: jest.fn() })),
  })),
  requestRecordingPermissionsAsync: jest.fn(async () => ({ granted: false })),
  setAudioModeAsync: jest.fn(async () => {}),
}));

jest.mock('expo-file-system', () => ({
  Paths: { cache: { uri: 'file:///cache/' } },
  Directory: jest.fn(() => ({ exists: false, create: jest.fn(), delete: jest.fn() })),
  File: jest.fn(() => ({
    exists: false,
    write: jest.fn(async () => {}),
    bytes: jest.fn(async () => new Uint8Array()),
    delete: jest.fn(),
    uri: 'file:///cache/x',
  })),
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 5 },
  AndroidNotificationVisibility: { PRIVATE: 2 },
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  setNotificationChannelAsync: jest.fn(async () => null),
  scheduleNotificationAsync: jest.fn(async () => 'daily-checkin'),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => {}),
  dismissAllNotificationsAsync: jest.fn(async () => {}),
  deleteNotificationChannelAsync: jest.fn(async () => {}),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
}));

jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  selectionAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
}));
