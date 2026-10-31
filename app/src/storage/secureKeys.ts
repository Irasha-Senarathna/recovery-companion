/** Every secure-store entry the app writes. Delete-all removes all of them. */
export const SECURE_KEYS = {
  dbKey: 'rc.db_key',
  pin: 'rc.pin',
  pinAttempts: 'rc.pin_attempts',
  bioToken: 'rc.bio_token',
  /** Support-circle accounts (M6): random ID + bearer token, one per role. */
  circleMember: 'rc.circle_member',
  circleSupporter: 'rc.circle_supporter',
} as const;
