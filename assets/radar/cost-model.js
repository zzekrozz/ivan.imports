/** Modelo de gastos compartido por servidor y navegador. No contiene importes: solo estructura y reglas. */
export const COST_GROUPS = { 1: "Transporte y viaje", 2: "Documentación y trámites", 3: "Impuestos", 4: "Preparación e imprevistos" };
export const COST_STATUS = { confirmed: "Confirmado", estimated: "Estimado", pending: "Pendiente", na: "No aplica" };
// scenario: truck = contratar transporte, pickup = recoger personalmente, both = siempre
export const COST_ITEMS = [
  { key: "flight", group: 1, label: "Billete de avión", scenario: "pickup" },
  { key: "airport_to_seller", group: 1, label: "Transporte aeropuerto → campa o vendedor", scenario: "pickup" },
  { key: "seller_to_airport", group: 1, label: "Transporte campa → aeropuerto, si procede", scenario: "pickup" },
  { key: "local_transport", group: 1, label: "Taxi, tren, autobús u otros desplazamientos", scenario: "pickup" },
  { key: "hotel", group: 1, label: "Hotel", scenario: "pickup" },
  { key: "meals", group: 1, label: "Comidas", scenario: "pickup" },
  { key: "truck", group: 1, label: "Transporte profesional del vehículo", scenario: "truck" },
  { key: "temp_plates", group: 1, label: "Placas temporales", scenario: "pickup" },
  { key: "temp_insurance", group: 1, label: "Seguro temporal", scenario: "pickup" },
  { key: "fuel", group: 1, label: "Combustible", scenario: "pickup" },
  { key: "tolls", group: 1, label: "Peajes", scenario: "pickup" },
  { key: "ferry", group: 1, label: "Ferry, si procede", scenario: "pickup" },
  { key: "other_transport", group: 1, label: "Otros gastos de transporte", scenario: "both" },
  { key: "itv", group: 2, label: "ITV de importación", scenario: "both" },
  { key: "reduced_sheet", group: 2, label: "Ficha reducida", scenario: "both" },
  { key: "coc", group: 2, label: "CoC, si procede", scenario: "both" },
  { key: "homologation", group: 2, label: "Homologación individual, si procede", scenario: "both" },
  { key: "dgt_fee", group: 2, label: "Tasa DGT", scenario: "both" },
  { key: "agency", group: 2, label: "Gestoría, si se utiliza", scenario: "both" },
  { key: "spanish_plates", group: 2, label: "Placas españolas", scenario: "both" },
  { key: "translations", group: 2, label: "Traducciones", scenario: "both" },
  { key: "certificates", group: 2, label: "Certificados o documentación adicional", scenario: "both" },
  { key: "other_paperwork", group: 2, label: "Otros trámites", scenario: "both" },
  { key: "registration_tax", group: 3, label: "Impuesto de matriculación (autoliquidación, modelo 576)", scenario: "both" },
  { key: "itp", group: 3, label: "ITP, cuando corresponda", scenario: "both" },
  { key: "vat", group: 3, label: "IVA, cuando corresponda", scenario: "both" },
  { key: "ivtm", group: 3, label: "IVTM municipal", scenario: "both" },
  { key: "other_taxes", group: 3, label: "Otros tributos aplicables", scenario: "both" },
  { key: "repairs", group: 4, label: "Reparaciones", scenario: "both" },
  { key: "maintenance", group: 4, label: "Mantenimiento inicial", scenario: "both" },
  { key: "tyres", group: 4, label: "Neumáticos", scenario: "both" },
  { key: "cleaning", group: 4, label: "Limpieza o preparación", scenario: "both" },
  { key: "contingency", group: 4, label: "Imprevistos", scenario: "both" },
];
export const COST_KEYS = new Set(COST_ITEMS.map((item) => item.key));
export const isCustomKey = (key) => /^custom:[a-z0-9-]{3,40}$/.test(String(key));
export const itemDef = (item) => COST_ITEMS.find((def) => def.key === item.key) || { key: item.key, group: item.group || 4, label: item.label || "Gasto personalizado", scenario: "both" };
export const relevant = (item, mode) => { const s = itemDef(item).scenario; return s === "both" || s === (mode === "pickup" ? "pickup" : "truck"); };
/** Cuenta en el total: aplicable, no marcado "No aplica", del escenario elegido y con importe. */
export const counts = (item, mode) => item.applicable !== false && item.status !== "na" && relevant(item, mode) && Number.isFinite(Number(item.amount));

/** El coche se cuenta una vez (price). Nunca se inventa un importe: lo que no está introducido no suma. */
export function costSummary({ price = 0, costs = {}, reference = null }) {
  const mode = costs.mode === "pickup" ? "pickup" : "truck";
  const items = Array.isArray(costs.items) ? costs.items : [];
  const subtotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const item of items) if (counts(item, mode)) subtotals[itemDef(item).group] += Number(item.amount);
  const total = Number(price) + Object.values(subtotals).reduce((a, b) => a + b, 0);
  const pending = items.filter((item) => item.applicable !== false && item.status === "pending" && relevant(item, mode)).map((item) => itemDef(item).label);
  const value = reference && Number(reference.value) > 0 ? Number(reference.value) : null;
  return { total: Math.round(total * 100) / 100, subtotals, pending, partial: pending.length > 0, mode, reference: value, difference: value === null ? null : Math.round((value - total) * 100) / 100, hasCosts: items.some((item) => counts(item, mode)) };
}
