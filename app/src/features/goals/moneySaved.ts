/** A daily amount above this is almost certainly a typing slip. */
export const MAX_PER_DAY = 1_000_000;

/** Daily amount × strong days. Strong days never reset, so neither does this. */
export function moneySaved(perDay: number | null, strongDays: number): number | null {
  return perDay && perDay > 0 ? perDay * strongDays : null;
}

const STEPS = [1_000, 5_000, 10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000];

export function nextMoneyMilestone(amount: number): number {
  return STEPS.find((step) => step > amount) ?? (Math.floor(amount / 500_000) + 1) * 500_000;
}

/** Plain digits with a comma every three (as used in Sri Lanka for everyday sums). */
export function formatAmount(amount: number): string {
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** A typed daily amount, or null if it is not a sensible positive whole number. */
export function parseAmount(typed: string): number | null {
  const clean = typed.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 && value <= MAX_PER_DAY ? value : null;
}
