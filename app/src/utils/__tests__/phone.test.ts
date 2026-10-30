import { isPlausiblePhone, normalizePhone, phoneTelUri } from '../phone';

describe('support phone numbers', () => {
  it.each([
    ['077 - 123 4567', 'tel:0771234567'],
    ['+94 77 000 0000', 'tel:+94770000000'],
    ['(011) 234-5678', 'tel:0112345678'],
  ])('keeps every digit of %s', (input, uri) => {
    expect(phoneTelUri(input)).toBe(uri);
  });

  it('normalises for saving', () => {
    expect(normalizePhone(' +94 77-000 0000 ')).toBe('+94770000000');
  });

  it.each([
    ['0771234567', true],
    ['+94 77 000 0000', true],
    ['123', false],
    ['abc', false],
    ['077 123 456x', false],
  ])('%s plausible: %s', (input, ok) => {
    expect(isPlausiblePhone(input)).toBe(ok);
  });
});
