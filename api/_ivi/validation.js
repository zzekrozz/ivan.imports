const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]+$/;
const CURRENCIES = new Set(["EUR", "GBP", "CHF", "DKK", "NOK", "SEK", "PLN", "CZK"]);
export const IVI_MODIFICATIONS = Object.freeze(["towbar", "wheels", "suspension", "exhaust", "lpg", "camper", "lighting", "bodyKit", "power", "other"]);

function text(value, limit) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}

function number(value, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = typeof value === "string" ? value.replace(/\s/g, "").replace(",", ".") : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

export function normalizeVin(value) {
  return text(value, 32).toUpperCase().replace(/[\s-]/g, "");
}

export function validateVin(value) {
  const vin = normalizeVin(value);
  if (!VIN_PATTERN.test(vin)) return { valid: false, vin, reason: "invalid_characters", warning: null };
  if (vin.length < 11 || vin.length > 18) return { valid: false, vin, reason: "invalid_length", warning: null };
  return { valid: true, vin, reason: null, warning: vin.length === 17 ? null : "non_standard_length" };
}

function normalizeModification(value) {
  if (value === true || value === "yes") return "yes";
  if (value === false || value === "no") return "no";
  return "unknown";
}

export function validateAnalysisInput(input = {}) {
  const errors = {};
  const vinResult = validateVin(input.vin);
  if (!vinResult.valid) errors.vin = vinResult.reason;
  const purchaseCountry = text(input.purchaseCountry, 80);
  if (purchaseCountry.length < 2) errors.purchaseCountry = "required";
  const mileageKm = number(input.mileageKm, { min: 0, max: 5_000_000 });
  if (mileageKm === null) errors.mileageKm = "invalid";
  const purchasePrice = number(input.purchasePrice, { min: 0, max: 100_000_000 });
  if (purchasePrice === null) errors.purchasePrice = "invalid";
  const currency = text(input.currency || "EUR", 3).toUpperCase();
  if (!CURRENCIES.has(currency)) errors.currency = "unsupported";
  const firstRegistration = text(input.firstRegistration, 10);
  if (firstRegistration && !/^\d{4}(?:-\d{2})?$/.test(firstRegistration)) errors.firstRegistration = "invalid";
  const modifications = Object.fromEntries(IVI_MODIFICATIONS.map((key) => [key, normalizeModification(input.modifications?.[key])]));
  return {
    valid: Object.keys(errors).length === 0,
    errors,
    value: {
      vin: vinResult.vin,
      vinFormatWarning: vinResult.warning,
      purchaseCountry,
      mileageKm,
      purchasePrice,
      currency,
      firstRegistration: firstRegistration || null,
      notes: text(input.notes, 1_000) || null,
      modifications,
    },
  };
}
