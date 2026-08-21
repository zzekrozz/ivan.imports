const IATA_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeIata(value) {
  const iata = String(value || "").trim().toUpperCase();
  return IATA_PATTERN.test(iata) ? iata : "";
}

export function normalizeDepartureDate(value) {
  const date = String(value || "").trim();
  if (!DATE_PATTERN.test(date)) return "";
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? "" : date;
}

export function buildFlightSearchUrl({
  originIata,
  destinationIata,
  departureDate = "",
  mediaPartnerId = "",
  market = "ES",
  locale = "es-ES",
  currency = "EUR",
} = {}) {
  const origin = normalizeIata(originIata);
  const destination = normalizeIata(destinationIata);
  if (!origin || !destination) throw new TypeError("originIata and destinationIata must be valid IATA codes");

  const partnerId = String(mediaPartnerId || "").trim();
  if (!partnerId) return "https://www.skyscanner.es/";

  const date = normalizeDepartureDate(departureDate);
  const pageType = date ? "day-view" : "calendar-month-view";
  const url = new URL(`https://skyscanner.net/g/referrals/v1/flights/${pageType}/`);
  url.searchParams.set("origin", origin.toLowerCase());
  url.searchParams.set("destination", destination.toLowerCase());
  if (date) url.searchParams.set("outboundDate", date);
  url.searchParams.set("adultsv2", "1");
  url.searchParams.set("cabinclass", "economy");
  url.searchParams.set("market", market);
  url.searchParams.set("locale", locale);
  url.searchParams.set("currency", currency);
  url.searchParams.set("mediaPartnerId", partnerId);
  return url.toString();
}
