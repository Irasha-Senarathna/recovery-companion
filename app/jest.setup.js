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
