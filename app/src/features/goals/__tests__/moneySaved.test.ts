import { formatAmount, moneySaved, nextMoneyMilestone, parseAmount } from '../moneySaved';

describe('money saved', () => {
  it('is the daily amount times strong days', () => {
    expect(moneySaved(1500, 30)).toBe(45_000);
  });

  it('is nothing until the user sets a daily amount', () => {
    expect(moneySaved(null, 30)).toBeNull();
    expect(moneySaved(0, 30)).toBeNull();
  });

  it('only grows: it uses strong days, which a slip never resets', () => {
    expect(moneySaved(500, 44)).toBeGreaterThan(0);
  });

  it.each([
    [0, 1_000],
    [999, 1_000],
    [1_000, 5_000],
    [12_000, 25_000],
    [180_000, 250_000],
    [1_200_000, 1_500_000],
  ])('after %i the next milestone is %i', (amount, next) => {
    expect(nextMoneyMilestone(amount)).toBe(next);
  });

  it('formats with thousands separators', () => {
    expect(formatAmount(1234567)).toBe('1,234,567');
    expect(formatAmount(0)).toBe('0');
  });

  it.each([
    ['1500', 1500],
    [' 1,500 ', 1500],
    ['0', null],
    ['-20', null],
    ['abc', null],
    ['1500000', null],
    ['', null],
  ])('reads %j as %p', (typed, expected) => {
    expect(parseAmount(typed)).toBe(expected);
  });
});
