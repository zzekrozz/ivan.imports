export const POPULAR_ORIGIN_AIRPORTS = Object.freeze([
  ["Málaga", "AGP"], ["Madrid", "MAD"], ["Barcelona", "BCN"], ["Alicante", "ALC"],
  ["Sevilla", "SVQ"], ["Valencia", "VLC"], ["Bilbao", "BIO"], ["Santiago", "SCQ"],
  ["Asturias", "OVD"], ["A Coruña", "LCG"], ["Vigo", "VGO"], ["Murcia", "RMU"],
  ["Granada", "GRX"], ["Jerez", "XRY"], ["Palma de Mallorca", "PMI"], ["Zaragoza", "ZAZ"],
]);

export function createFlightPlannerState() {
  return {
    open: false,
    status: "idle",
    query: "",
    origin: "Málaga (AGP)",
    departureDate: "",
    candidates: [],
    selectedCandidate: null,
    message: "",
    attribution: "",
    attributionUrl: "",
  };
}

export function iataFromAirportInput(value) {
  const source = String(value || "").trim().toUpperCase();
  const parenthesized = source.match(/\(([A-Z]{3})\)\s*$/)?.[1];
  if (parenthesized) return parenthesized;
  return /^[A-Z]{3}$/.test(source) ? source : "";
}

export function buildFlightRedirectPath({ originIata, destinationIata, departureDate = "" } = {}) {
  if (!/^[A-Z]{3}$/.test(String(originIata || "")) || !/^[A-Z]{3}$/.test(String(destinationIata || ""))) return "";
  const params = new URLSearchParams({ action: "redirect", origin: originIata, destination: destinationIata });
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(departureDate || ""))) params.set("date", departureDate);
  return `/api/flight-planner?${params}`;
}
