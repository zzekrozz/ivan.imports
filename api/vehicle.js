import { providerForUrl } from "./_vehicle/providers.js";

const errorMessages = Object.freeze({
  invalid_json: "La solicitud no contiene JSON válido.",
  invalid_url: "El enlace no parece válido.",
  unsupported_source: "Este portal todavía no es compatible con la importación automática.",
  listing_unavailable: "El anuncio ya no está disponible o no hemos podido acceder a él.",
  provider_blocked: "Mobile.de ha bloqueado temporalmente la lectura automática.",
  provider_timeout: "Mobile.de ha tardado demasiado en responder.",
  provider_unavailable: "No hemos podido leer automáticamente el anuncio.",
  parse_failed: "El anuncio respondió, pero no contenía datos públicos que pudiéramos interpretar.",
});

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" } });
}

export function createVehicleHandler({ fetchImpl = fetch } = {}) {
  return async function handler(request) {
    if (request.method !== "POST") return json({ success: false, error: "method_not_allowed", message: "Método no permitido." }, 405);
    if (!(request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")) return json({ success: false, error: "invalid_json", message: errorMessages.invalid_json }, 415);
    let body;
    try { body = await request.json(); } catch { return json({ success: false, error: "invalid_json", message: errorMessages.invalid_json }, 400); }
    const url = String(body?.url || "").trim().slice(0, 2_000);
    if (!url) return json({ success: false, error: "invalid_url", message: errorMessages.invalid_url }, 400);
    let parsed;
    try { parsed = new URL(url); } catch { return json({ success: false, error: "invalid_url", message: errorMessages.invalid_url }, 400); }
    if (parsed.protocol !== "https:") return json({ success: false, error: "invalid_url", message: errorMessages.invalid_url }, 400);
    const provider = providerForUrl(url);
    if (!provider) return json({ success: false, error: "unsupported_source", message: errorMessages.unsupported_source }, 422);
    try {
      const vehicle = await provider.fetchListing(url, { fetchImpl });
      return json({ success: true, source: provider.id, vehicle });
    } catch (error) {
      const code = error?.code && errorMessages[error.code] ? error.code : "provider_unavailable";
      const status = code === "invalid_url" ? 400 : code === "listing_unavailable" ? 404 : code === "provider_blocked" ? 503 : 502;
      console.warn(JSON.stringify({ event: "vehicle_import_failed", source: provider.id, code, status: error?.status || null }));
      return json({ success: false, error: code, message: errorMessages[code] }, status);
    }
  };
}

const webHandler = createVehicleHandler();

async function nodeRequestToWeb(request) {
  const headers = new Headers();
  Object.entries(request.headers || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, String(value));
  });
  let body = request.body;
  if (body && typeof body === "object" && !(body instanceof Uint8Array)) body = JSON.stringify(body);
  if (body === undefined && request.method !== "GET" && request.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of request) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    body = Buffer.concat(chunks);
  }
  const host = headers.get("host") || "ivanimports.es";
  const protocol = headers.get("x-forwarded-proto") || "https";
  return new Request(new URL(request.url || "/api/vehicle", `${protocol}://${host}`), { method: request.method || "GET", headers, body: ["GET", "HEAD"].includes(request.method) ? undefined : body });
}

async function sendNodeResponse(response, result) {
  response.statusCode = result.status;
  result.headers.forEach((value, key) => response.setHeader(key, value));
  response.end(Buffer.from(await result.arrayBuffer()));
}

export default async function vehicleHandler(request, response) {
  if (request instanceof Request) return webHandler(request);
  const result = await webHandler(await nodeRequestToWeb(request));
  return sendNodeResponse(response, result);
}
