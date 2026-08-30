export const IVI_SCHEMA_VERSION = 1;
export const IVI_REPORT_STATES = Object.freeze(["DRAFT", "PROCESSING", "READY", "PARTIAL", "NO_DATA", "FAILED"]);
export const UNKNOWN = "unknown";

const clean = (value) => {
  const result = String(value ?? "").replace(/\s+/g, " ").trim();
  return result || null;
};

const first = (...values) => values.map(clean).find(Boolean) || null;

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function point(value, { source = "ONE_AUTO", confidence = "high", status, retrievedAt = new Date().toISOString() } = {}) {
  const empty = value === null || value === undefined || value === "";
  return { value: empty ? null : value, source: empty ? null : source, confidence: empty ? "unknown" : confidence, status: status || (empty ? "unknown" : "confirmed"), retrievedAt: empty ? null : retrievedAt };
}

export const unknownPoint = () => point(null);

function optionText(option) {
  return [option?.factory_desc, option?.factoryDescription, option?.description, option?.additional_desc, option?.additionalDescription].map(clean).filter(Boolean).join(" · ");
}

function isNegativeOption(text) {
  return /^(?:without|no |not fitted|sin |ohne |kein(?:e|en|er|es)?\b)/i.test(text) || /(?:without|not fitted|sin equipar|no equipado)/i.test(text);
}

const EQUIPMENT_GROUPS = Object.freeze([
  ["registration", /tow.?bar|trailer hitch|anh[aä]nger|attelage|remolque|wheel|rim|llanta|suspension|lighting|headlamp|faros?|exhaust|escape|lpg|glp/i],
  ["safety", /adas|assist|camera|cámara|radar|lane|blind spot|airbag|cruise|parking|parktronic|collision|brake assist/i],
  ["comfort", /seat|asiento|heated|calefact|climat|air conditioning|roof|techo|navigation|naveg|audio|sound|wifi|head.?up|hud/i],
  ["exterior", /paint|colour|color|wheel|rim|llanta|body|spoiler|sunroof|roof rail|exterior/i],
  ["interior", /interior|trim|upholstery|tapicer|leather|cuero|seat|asiento|dashboard/i],
]);

function equipmentGroup(label) {
  return EQUIPMENT_GROUPS.find(([, pattern]) => pattern.test(label))?.[0] || "other";
}

function triState(options, pattern, retrievedAt) {
  const matches = options.map((option) => ({ option, label: optionText(option) })).filter(({ label }) => pattern.test(label));
  const positive = matches.find(({ label }) => !isNegativeOption(label));
  if (positive) return point(true, { retrievedAt });
  const negative = matches.find(({ label }) => isNegativeOption(label));
  if (negative) return point(false, { retrievedAt });
  return unknownPoint();
}

function normalizeOptions(rawOptions, retrievedAt) {
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  return options.slice(0, 500).map((option, index) => {
    const description = optionText(option);
    return {
      code: first(option?.factory_code, option?.factoryCode, option?.code) || `option-${index + 1}`,
      description: description || "Opción sin descripción",
      fitted: description ? !isNegativeOption(description) : null,
      group: equipmentGroup(description),
      provenance: point(description, { retrievedAt }),
    };
  });
}

function field(raw, names, retrievedAt, { number = false, confidence = "high" } = {}) {
  const value = names.map((name) => raw?.[name]).find((candidate) => candidate !== null && candidate !== undefined && candidate !== "");
  return point(number ? numeric(value) : clean(value), { retrievedAt, confidence });
}

function unwrap(payload) {
  const candidate = payload?.result ?? payload?.data ?? payload ?? {};
  return Array.isArray(candidate) ? candidate[0] || {} : candidate;
}

function prefer(primary, fallback) {
  return primary?.value !== null && primary?.value !== undefined && primary?.value !== "" ? primary : fallback || unknownPoint();
}

export function normalizeOneAutoIdentityResponse(payload, { retrievedAt = new Date().toISOString() } = {}) {
  const raw = unwrap(payload);
  return {
    identity: {
      manufacturer: field(raw, ["manufacturer_desc", "manufacturer", "make"], retrievedAt),
      model: field(raw, ["model_desc", "model_range_desc", "model"], retrievedAt),
      variant: field(raw, ["derivative_desc", "variant", "version"], retrievedAt),
      bodyType: field(raw, ["body_type_desc", "body_type", "bodyType"], retrievedAt),
      modelYear: field(raw, ["manufactured_year", "model_year", "year"], retrievedAt, { number: true }),
    },
    technical: {
      fuel: field(raw, ["fuel_type_desc", "fuel_type", "fuel"], retrievedAt),
      transmission: field(raw, ["transmission_desc", "transmission"], retrievedAt),
    },
    source: { provider: "ONE_AUTO", product: "VIN_DECODER", retrievedAt, status: payload?.success === false ? "partial" : "received" },
  };
}

export function normalizeOneAutoResponse(payload, { vin, retrievedAt = new Date().toISOString(), identityPayload = null } = {}) {
  const raw = unwrap(payload);
  const decoded = identityPayload ? normalizeOneAutoIdentityResponse(identityPayload, { retrievedAt }) : null;
  const options = normalizeOptions(raw.options || raw.factory_options || raw.equipment, retrievedAt);
  const fitted = options.filter((option) => option.fitted === true);
  const titlePart = (pattern) => fitted.find((option) => pattern.test(option.description))?.description || null;
  const typeApproval = field(raw, ["european_type_approval", "europeanTypeApproval", "type_approval", "typeApproval"], retrievedAt);
  const co2 = field(raw, ["co2", "co2_emissions", "co2Emissions", "co2_g_km"], retrievedAt, { number: true });
  return {
    schemaVersion: IVI_SCHEMA_VERSION,
    vin: point(vin, { source: "USER", retrievedAt }),
    identity: {
      manufacturer: prefer(field(raw, ["manufacturer", "make", "oem_make"], retrievedAt), decoded?.identity.manufacturer),
      model: prefer(field(raw, ["model", "model_name", "oem_model"], retrievedAt), decoded?.identity.model),
      variant: prefer(field(raw, ["variant", "version", "model_variant"], retrievedAt), decoded?.identity.variant),
      bodyType: prefer(field(raw, ["body_type", "bodyType", "body"], retrievedAt), decoded?.identity.bodyType),
      modelYear: prefer(field(raw, ["model_year", "modelYear", "year"], retrievedAt, { number: true }), decoded?.identity.modelYear),
    },
    factory: {
      manufacturedDate: field(raw, ["manufactured_date", "manufacture_date", "manufacturedDate"], retrievedAt),
      deliveredDate: field(raw, ["delivered_date", "delivery_date", "deliveredDate"], retrievedAt),
      colour: field(raw, ["oem_colour_desc", "oem_color_desc", "colour", "color"], retrievedAt),
      paintCode: field(raw, ["paint_code", "oem_paint_code"], retrievedAt),
      interiorTrim: field(raw, ["oem_interior_trim_desc", "interior_trim", "interior"], retrievedAt),
    },
    technical: {
      engine: field(raw, ["oem_engine_desc", "engine", "engine_description"], retrievedAt),
      engineCode: field(raw, ["engine_code", "oem_engine_code"], retrievedAt),
      powerKw: field(raw, ["power_kw", "powerKw"], retrievedAt, { number: true }),
      displacementCc: field(raw, ["engine_cc", "displacement_cc", "displacementCc"], retrievedAt, { number: true }),
      fuel: prefer(field(raw, ["fuel", "fuel_type", "fuelType"], retrievedAt), decoded?.technical.fuel),
      transmission: prefer(field(raw, ["oem_transmission_type_desc", "transmission", "transmission_description"], retrievedAt), decoded?.technical.transmission),
      transmissionCode: field(raw, ["transmission_code", "oem_transmission_code"], retrievedAt),
      drivetrain: field(raw, ["oem_drivetrain_desc", "drivetrain", "drive_type"], retrievedAt),
      wheels: field(raw, ["oem_wheel_desc", "wheels", "wheel_description"], retrievedAt),
    },
    emissions: {
      co2: { ...co2, unit: "g/km", standard: clean(raw.co2_standard || raw.emissions_standard), confidence: co2.value === null ? "unknown" : "medium", status: co2.value === null ? "unknown" : "estimated" },
      euroNorm: field(raw, ["euro_norm", "emission_class", "emissions_class"], retrievedAt),
    },
    homologation: {
      status: typeApproval.value ? "likely" : "not_confirmed",
      europeanTypeApproval: typeApproval,
      evidence: typeApproval.value ? ["Referencia de homologación devuelta por el proveedor; requiere comprobación documental."] : [],
    },
    equipment: {
      highlights: [
        titlePart(/head.?up|hud/i), titlePart(/panoramic|panorámico/i), titlePart(/360.*camera|camera.*360/i),
        titlePart(/adaptive.*light|faros.*adapt/i), titlePart(/premium.*audio|harman|bose|burmester/i), titlePart(/heated.*seat|asiento.*calefact/i),
      ].filter(Boolean).slice(0, 8),
      groups: Object.fromEntries(["comfort", "safety", "exterior", "interior", "registration", "other"].map((group) => [group, fitted.filter((item) => item.group === group)])),
      all: options,
      relevant: {
        towbar: triState(options, /tow.?bar|trailer hitch|anh[aä]nger|attelage|remolque/i, retrievedAt),
        wheels: point(field(raw, ["oem_wheel_desc", "wheels", "wheel_description"], retrievedAt).value, { retrievedAt }),
        suspension: triState(options, /suspension|fahrwerk|amortigu/i, retrievedAt),
        lighting: triState(options, /lighting|headlamp|faros?|scheinwerfer/i, retrievedAt),
      },
    },
    sources: [
      { provider: "ONE_AUTO", product: "OE_BUILD_SHEET_EUROPE", retrievedAt, status: payload?.success === false ? "partial" : Object.keys(raw).length ? "received" : "no_data" },
      ...(decoded ? [decoded.source] : []),
    ],
  };
}

export function meaningfulVehicleData(vehicle) {
  const points = [vehicle?.identity?.manufacturer, vehicle?.identity?.model, vehicle?.factory?.manufacturedDate, vehicle?.technical?.engine, vehicle?.technical?.transmission, vehicle?.factory?.colour];
  return points.filter((item) => item?.value).length + (vehicle?.equipment?.all?.length || 0);
}
