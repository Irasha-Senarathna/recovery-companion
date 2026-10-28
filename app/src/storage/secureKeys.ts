/** Every secure-store entry the app writes. Delete-all removes all of them. */
export const SECURE_KEYS = {
  dbKey: 'rc.db_key',
  pin: 'rc.pin',
  pinAttempts: 'rc.pin_attempts',
  bioToken: 'rc.bio_token',
} as const;
