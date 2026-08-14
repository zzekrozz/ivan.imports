export function normalizeNumberFieldValue(value, { min = "", max = "" } = {}) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";

  const minimum = min === "" ? Number.NEGATIVE_INFINITY : Number(min);
  const maximum = max === "" ? Number.POSITIVE_INFINITY : Number(max);
  return Math.min(Number.isFinite(maximum) ? maximum : Number.POSITIVE_INFINITY,
    Math.max(Number.isFinite(minimum) ? minimum : Number.NEGATIVE_INFINITY, number));
}
