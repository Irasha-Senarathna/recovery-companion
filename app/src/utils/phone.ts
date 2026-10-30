/** Minimum digits for a personal phone number (local numbers have 7+). */
export const MIN_PHONE_DIGITS = 7;

/**
 * Keeps a leading + and every digit, dropping spaces, dashes and brackets.
 * Unlike the helpline `telUri`, it never cuts the number at a dash.
 */
export function normalizePhone(phone: string): string {
  const plus = phone.trim().startsWith('+') ? '+' : '';
  return plus + phone.replace(/\D/g, '');
}

export function isPlausiblePhone(phone: string): boolean {
  return (
    !/[^\d\s+()-]/.test(phone.trim()) &&
    normalizePhone(phone).replace('+', '').length >= MIN_PHONE_DIGITS
  );
}

export function phoneTelUri(phone: string): string {
  return `tel:${normalizePhone(phone)}`;
}
