/**
 * Money utility — expert-level financial calculations.
 * 
 * RULE: Never use raw floating-point arithmetic for money.
 * All amounts are rounded to 2 decimals (paisa) at every step.
 * 
 * Why: 0.1 + 0.2 = 0.30000000000000004 in JavaScript.
 * For "not a penny off" accuracy, every operation must round.
 */

/** Round to 2 decimals (paisa). Handles floating point errors. */
export const round2 = (n) => {
  const num = Number(n) || 0;
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

/** Add multiple amounts, rounded to 2 decimals. */
export const add = (...amounts) => {
  return round2(amounts.reduce((sum, a) => sum + (Number(a) || 0), 0));
};

/** Subtract b from a, rounded to 2 decimals. */
export const sub = (a, b) => round2((Number(a) || 0) - (Number(b) || 0));

/** Multiply, rounded to 2 decimals. */
export const mul = (a, b) => round2((Number(a) || 0) * (Number(b) || 0));

/** Calculate percentage of amount, rounded to 2 decimals. */
export const pct = (amount, percent) => round2((Number(amount) || 0) * (Number(percent) || 0) / 100);

/** Sum an array of objects by key, rounded to 2 decimals. */
export const sumBy = (arr, key) => {
  if (!Array.isArray(arr)) return 0;
  return round2(arr.reduce((sum, item) => sum + (Number(item?.[key]) || 0), 0));
};

/** Check if two amounts are equal (within half a paisa). */
export const eq = (a, b) => Math.abs((Number(a) || 0) - (Number(b) || 0)) < 0.005;

/** Format for display: Rs. 1,234.56 */
export const fmt = (n) => {
  const num = round2(n);
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Split an amount into N parts that sum EXACTLY to the original.
 * Last part gets the remainder to avoid penny-off errors.
 * E.g. split(100, 3) → [33.33, 33.33, 33.34]
 */
export const splitEvenly = (total, parts) => {
  const t = round2(total);
  const n = Math.max(1, Math.floor(parts));
  const each = Math.floor((t * 100) / n) / 100;
  const result = Array(n).fill(each);
  const remainder = round2(t - each * n);
  result[n - 1] = round2(result[n - 1] + remainder);
  return result;
};

export default { round2, add, sub, mul, pct, sumBy, eq, fmt, splitEvenly };
